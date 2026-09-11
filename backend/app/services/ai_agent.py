import os
from google import genai
from google.genai import types

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    return _client


# ---- Tools ----

def list_transactions(limit: int = 50) -> list[dict]:
    """List recent transactions, newest first. Use when the user asks to see
    transactions or wants specific items. Returns up to `limit` rows.

    Args:
        limit: Maximum number of transactions to return (default 50).
    """
    from ..database import SessionLocal
    from .. import models
    db = SessionLocal()
    try:
        rows = (
            db.query(models.Transaction)
            .order_by(models.Transaction.id.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "id": r.id,
                "description": r.description,
                "amount": float(r.amount),
                "category": r.category,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    finally:
        db.close()


def spending_by_category() -> dict:
    """Return total spending grouped by category. Use for questions like
    'how much did I spend on food' or 'what is my biggest category'.
    Returns a dict of {category: total_amount}.
    """
    from ..database import SessionLocal
    from .. import models
    from sqlalchemy import func
    db = SessionLocal()
    try:
        rows = (
            db.query(
                models.Transaction.category,
                func.sum(models.Transaction.amount).label("total"),
            )
            .group_by(models.Transaction.category)
            .all()
        )
        return {cat or "uncategorized": float(total or 0) for cat, total in rows}
    finally:
        db.close()


def total_spending() -> dict:
    """Return the sum of ALL transactions, plus the count. Use for questions
    like 'how much have I spent in total' or 'what is my total spend'.
    Returns {'total': amount, 'count': n}.
    """
    from ..database import SessionLocal
    from .. import models
    from sqlalchemy import func
    db = SessionLocal()
    try:
        total, count = db.query(
            func.coalesce(func.sum(models.Transaction.amount), 0),
            func.count(models.Transaction.id),
        ).one()
        return {"total": float(total), "count": int(count)}
    finally:
        db.close()


# ---- Agent ----

SYSTEM_INSTRUCTION = """You are FlowLedger, a financial operations copilot.
You help the user understand their transactions and spending.

Rules:
- ALWAYS call a tool before answering anything about spending or transactions. Never guess numbers.
- For "total" or "overall" or "everything" questions, call total_spending.
- For "by category" or "on <category>" questions, call spending_by_category.
- For "list" or "show me" or "last N" questions, call list_transactions.
- If a tool returns an empty result, say so plainly.
- Be concise. Format amounts with two decimals and a currency symbol.
"""


def chat(user_message: str) -> str:
    client = _get_client()
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        tools=[list_transactions, spending_by_category, total_spending],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(
            maximum_remote_calls=8
        ),
    )
    chat_session = client.chats.create(model="gemini-3.6-flash", config=config)
    response = chat_session.send_message(user_message)
    text = response.text
    if not text:
        return "I couldn't produce an answer for that. Try rephrasing."
    return text
