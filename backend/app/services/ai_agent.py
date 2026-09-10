import os
from google import genai
from google.genai import types
from sqlalchemy.orm import Session
from .. import models

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    return _client


# ---- Tools the agent can call ----

def list_transactions(limit: int = 50) -> list[dict]:
    """List recent transactions. Use this to answer questions about spending,
    categories, or totals. Returns up to `limit` transactions, newest first.

    Args:
        limit: Maximum number of transactions to return.
    """
    from ..database import SessionLocal

    db: Session = SessionLocal()
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
    """Return total spending grouped by category. Use this for questions like
    'how much did I spend on food' or 'what is my biggest category'.
    """
    from ..database import SessionLocal
    from sqlalchemy import func

    db: Session = SessionLocal()
    try:
        rows = (
            db.query(
                models.Transaction.category,
                func.sum(models.Transaction.amount).label("total"),
            )
            .group_by(models.Transaction.category)
            .all()
        )
        return {cat: float(total) for cat, total in rows}
    finally:
        db.close()


# ---- Agent loop ----

SYSTEM_INSTRUCTION = """You are FlowLedger, a financial operations copilot.
You help the user understand their transactions and spending.
Use the provided tools to fetch real data before answering.
Be concise. When you report amounts, include the category and total.
If the user asks something you cannot answer with the available tools, say so."""


def chat(user_message: str) -> str:
    client = _get_client()

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        tools=[list_transactions, spending_by_category],
        automatic_function_calling=types.AutomaticFunctionCallingConfig(
            maximum_remote_calls=5
        ),
    )

    chat_session = client.chats.create(
        model="gemini-3.6-flash",
        config=config,
    )

    response = chat_session.send_message(user_message)
    return response.text
