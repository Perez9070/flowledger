from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.ai_agent import chat

router = APIRouter(prefix="/api/agent", tags=["agent"])


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(req: ChatRequest):
    try:
        reply = chat(req.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {e}")
    return ChatResponse(reply=reply)
