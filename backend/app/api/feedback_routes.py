from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List, Optional
from app.services.resume_feedback import score_resume, suggest_missing_skills

router = APIRouter()

@router.get("/feedback/ping", summary="Feedback router ping")
def feedback_ping():
    return {"ok": True}

class ResumeIn(BaseModel):
    text: str = Field(..., description="Raw extracted resume text")
    skills: List[str] = Field(default_factory=list)
    years_exp: float = 0.0

class MissingSkillsReq(BaseModel):
    resume_text: str
    resume_skills: List[str] = []
    target_role: Optional[str] = Field(default=None)
    jobs: Optional[List[str]] = None

@router.post("/feedback/resume-score", summary="Rate my resume")
def resume_score(resume: ResumeIn):
    return score_resume(resume.text, resume.skills, resume.years_exp)

@router.post("/feedback/suggest-missing-skills", summary="Suggest missing skills")
def missing_skills(req: MissingSkillsReq):
    return suggest_missing_skills(
        resume_text=req.resume_text,
        resume_skills=req.resume_skills,
        target_role=req.target_role,
        jobs=req.jobs or [],
    )
