# app/api/v1/jobs.py (unchanged except the try/except)
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import logging
from app.utils import get_top_terms

log = logging.getLogger("app")
router = APIRouter()

class AnalyzeJobsIn(BaseModel):
    job_texts: List[str]

@router.post("/analyze-jobs", tags=["jobs"], summary="Analyze Jobs")
def analyze_jobs(payload: AnalyzeJobsIn):
    try:
        top = get_top_terms(payload.job_texts, top_k=25, use_tfidf=True, include_bigrams=True)
        return {"top_skills": top}
    except Exception as e:
        log.exception("analyze-jobs failed")
        raise HTTPException(status_code=400, detail=str(e))
