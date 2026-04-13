# backend/app/api/recommend.py
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
from app.services.file_read import read_upload_text

router = APIRouter()

@router.post("/extract-skills", summary="Extract Skills (.txt/.pdf or text)")
async def extract_skills_endpoint(
    file: UploadFile | None = File(None),
    text: Optional[str] = Form(None),
):
    if file:
        content, _ = await read_upload_text(file)
    else:
        if not text:
            raise HTTPException(status_code=400, detail="Send a file or 'text'.")
        content = text
    words = set(w.strip("., ").lower() for w in content.split())
    skills = [s for s in ["python","sql","xgboost","pandas","docker","aws"] if s in words]
    return {"skills": skills}

class GapsIn(BaseModel):
    resume_skills: List[str]
    job_skills: List[str]

@router.post("/compute-gaps", summary="Compute Gaps")
def compute_gaps_endpoint(body: GapsIn):
    have = set(map(str.lower, body.resume_skills))
    need = set(map(str.lower, body.job_skills))
    return {"missing": sorted(list(need - have)), "overlap": sorted(list(have & need))}

class RecommendIn(BaseModel):
    missing: List[str]

@router.post("/recommend", summary="Recommend Courses")
def recommend_courses_endpoint(body: RecommendIn):
    demo: Dict[str, List[Dict]] = {
        "xgboost": [{"title":"End-to-End XGBoost","provider":"Udemy"}],
        "sql": [{"title":"Practical SQL","provider":"Dataquest"}],
    }
    out = {k.lower(): demo.get(k.lower(), []) for k in body.missing}
    return {"recommendations": out}
