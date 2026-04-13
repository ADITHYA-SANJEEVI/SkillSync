from __future__ import annotations
from fastapi import APIRouter, Body, HTTPException, Query
from app.services.chutes_client import llm_complete, ChutesError

router = APIRouter(prefix="/api/v1/llm/ml", tags=["llm-ml"])

@router.post(
    "/recommend",
    summary="LLM Recommend (plain text body)",
    responses={
        200: {"description": "OK"},
        400: {"description": "Bad Request"},
        502: {"description": "Upstream LLM error"},
    },
)
async def recommend_plaintext(
    text: str = Body(..., media_type="text/plain", description="Plain text prompt"),
    ai: int = Query(1, description="Compat toggle"),
    temperature: float = Query(0.2),
    max_tokens: int = Query(700),
):
    txt = (text or "").strip()
    if not txt:
        raise HTTPException(status_code=400, detail="Empty text body.")
    try:
        out = llm_complete(prompt=txt, temperature=temperature, max_tokens=max_tokens)
    except ChutesError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {
        "ok": True,
        "ai": ai,
        "chars_in": len(txt),
        "temperature": temperature,
        "model_tokens": max_tokens,
        "result": out,
    }
