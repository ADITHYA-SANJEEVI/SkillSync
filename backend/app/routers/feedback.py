from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from app.services.feedback import rate_resume, suggest_missing_skills

router = APIRouter(prefix="/api/v1/feedback", tags=["feedback"])

class RateRequest(BaseModel):
    resume_text: str = Field(..., description="Raw resume text (paste).")
    target_role: Optional[str] = Field(None, description="Optional target role/title.")

class MissingSkillsRequest(BaseModel):
    resume_text: str = Field(..., description="Raw resume text (paste).")
    target_role: Optional[str] = Field(None, description="Optional target role/title.")

@router.post("/rate")
def rate(req: RateRequest) -> Dict[str, Any]:
    try:
        return rate_resume(req.resume_text, req.target_role)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/suggest-missing-skills")
def missing(req: MissingSkillsRequest) -> Dict[str, Any]:
    try:
        return suggest_missing_skills(req.resume_text, req.target_role)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
