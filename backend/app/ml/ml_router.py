# app/ml/ml_router.py
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

from app.ml.catalog import CATALOG  # still imported in case other funcs use it
from app.ml.skills import extract_skill_candidates, normalize_to_catalog
from app.ml.gaps import compute_gaps
from app.ml.recommend import recommend
from app.ml.file_extractors import (
    extract_text_from_resume_file,
    extract_text_from_job_file_or_text,
)

router = APIRouter(prefix="/ml", tags=["ml"])

class AnalyzeJobsResponse(BaseModel):
    postings: int
    skill_candidates: List[str]
    normalized_skills: List[str]

class GapsResponse(BaseModel):
    missing: List[str]
    partial: List[str]
    extras: List[str]

class RecommendResponse(BaseModel):
    recommendations: List[Dict[str, Any]]
    used_skills: List[str]

@router.post("/extract-skills", response_model=AnalyzeJobsResponse)
async def extract_skills_endpoint(
    jobs_file: Optional[UploadFile] = File(None),
    jobs_text: Optional[str] = Form(None),
):
    try:
        if not jobs_file and not jobs_text:
            raise HTTPException(status_code=400, detail="Provide jobs_file or jobs_text")

        text = await extract_text_from_job_file_or_text(jobs_file, jobs_text)
        if not text or not text.strip():
            raise HTTPException(status_code=400, detail="No text could be extracted from the input.")

        postings = 1 if (jobs_text and not jobs_file) else 0

        candidates = extract_skill_candidates(text) or []
        normalized = normalize_to_catalog(candidates)  # ← no CATALOG arg

        return AnalyzeJobsResponse(
            postings=postings,
            skill_candidates=sorted({c for c in candidates if isinstance(c, str) and c.strip()}),
            normalized_skills=sorted({s for s in normalized if isinstance(s, str) and s.strip()}),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"extract-skills failed: {type(e).__name__}: {e}")

@router.post("/compute-gaps", response_model=GapsResponse)
async def compute_gaps_endpoint(
    resume_file: Optional[UploadFile] = File(None),
    resume_text: Optional[str] = Form(None),
    jobs_file: Optional[UploadFile] = File(None),
    jobs_text: Optional[str] = Form(None),
):
    try:
        if not (resume_file or resume_text):
            raise HTTPException(status_code=400, detail="Provide resume_file or resume_text")
        if not (jobs_file or jobs_text):
            raise HTTPException(status_code=400, detail="Provide jobs_file or jobs_text")

        resume_raw = await extract_text_from_resume_file(resume_file, resume_text)
        jobs_raw = await extract_text_from_job_file_or_text(jobs_file, jobs_text)

        cand_candidates = extract_skill_candidates(resume_raw) or []
        job_candidates = extract_skill_candidates(jobs_raw) or []

        cand_norm = normalize_to_catalog(cand_candidates)  # ← no CATALOG arg
        job_norm = normalize_to_catalog(job_candidates)    # ← no CATALOG arg

        gaps = compute_gaps(candidate_skills=cand_norm, job_skills=job_norm)
        return GapsResponse(**gaps)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"compute-gaps failed: {type(e).__name__}: {e}")

@router.post("/recommend", response_model=RecommendResponse)
async def recommend_courses_endpoint(
    resume_file: Optional[UploadFile] = File(None),
    resume_text: Optional[str] = Form(None),
    jobs_file: Optional[UploadFile] = File(None),
    jobs_text: Optional[str] = Form(None),
    limit: int = Form(8),
):
    try:
        if not (resume_file or resume_text):
            raise HTTPException(status_code=400, detail="Provide resume_file or resume_text")
        if not (jobs_file or jobs_text):
            raise HTTPException(status_code=400, detail="Provide jobs_file or jobs_text")

        resume_raw = await extract_text_from_resume_file(resume_file, resume_text)
        jobs_raw = await extract_text_from_job_file_or_text(jobs_file, jobs_text)

        cand_norm = set(normalize_to_catalog(extract_skill_candidates(resume_raw) or []))  # ← no CATALOG arg
        job_norm = set(normalize_to_catalog(extract_skill_candidates(jobs_raw) or []))      # ← no CATALOG arg
        needs = sorted(list(job_norm - cand_norm))

        recs = recommend(needed_skills=needs, catalog=CATALOG, limit=limit)
        return RecommendResponse(recommendations=recs, used_skills=needs)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"recommend failed: {type(e).__name__}: {e}")
