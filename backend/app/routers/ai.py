from __future__ import annotations
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Body, Query
from pydantic import BaseModel, Field
from app.services.llm_client import llm

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])

# =============================
# Existing chat endpoint (JSON)
# =============================

class ChatTurn(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatTurn]
    temperature: float = Field(0.2, ge=0.0, le=2.0)

@router.post("/chat")
def ai_chat(req: ChatRequest) -> Dict[str, Any]:
    try:
        content = llm.chat([t.dict() for t in req.messages], temperature=req.temperature)
        return {"content": content, "llm_used": llm.enabled}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===========================================
# New plain-text endpoint (no JSON required)
# ===========================================

class CompletionChoice(BaseModel):
    content: str

class CompletionResponse(BaseModel):
    choices: List[CompletionChoice]
    usage: Optional[dict] = None


@router.post(
    "/prompt",
    response_model=CompletionResponse,
    summary="Chat completion from plain text",
)
async def ai_prompt(
    prompt: str = Body(
        ...,
        media_type="text/plain",
        description="Type a plain text prompt here — no JSON needed.",
        examples=["Explain quantum computing in simple words."]
    ),
    temperature: float = Query(0.2, ge=0.0, le=1.0, description="Randomness control"),
    max_tokens: int = Query(200, ge=1, le=4096, description="Maximum response length"),
):
    """
    Accepts a plain text body instead of JSON.  
    Lets users type directly into Swagger without worrying about structure.
    """
    try:
        # Convert plain text into messages for your LLM client
        messages = [{"role": "user", "content": prompt}]
        content = llm.chat(messages, temperature=temperature)

        return CompletionResponse(
            choices=[CompletionChoice(content=content)],
            usage={"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
