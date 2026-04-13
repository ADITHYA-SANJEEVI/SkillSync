# app/api/ai.py
from __future__ import annotations
from typing import Literal, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.llm_client import llm

router = APIRouter(prefix="/api/v1", tags=["ai"])

class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(..., min_length=1)

class ChatRequest(BaseModel):
    messages: List[ChatMessage]          # ✅ replaced conlist(...)
    temperature: float = 0.2

class ChatResponse(BaseModel):
    content: str
    llm_used: bool = True

@router.post("/ai/chat", response_model=ChatResponse, summary="Chat with Chutes")
def chat(req: ChatRequest) -> ChatResponse:
    result = llm.chat_full(
        messages=[m.model_dump() for m in req.messages],
        temperature=req.temperature,
    )

    if result.get("error"):
        raise HTTPException(status_code=result.get("status", 502), detail=result["error"])

    content = (result.get("content") or "").strip() or "(No content returned.)"
    return ChatResponse(content=content, llm_used=result.get("llm_used", True))
