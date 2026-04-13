# app/api/v1/ml.py
from __future__ import annotations

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

# Existing imports (keep these)
from app.ml.models import ExtractRequest, GapRequest, RecommendRequest, ExtractResponse
from app.ml.skills import extract_skill_candidates, normalize_to_catalog, closest_role
from app.ml.gaps import compute_skill_gap
from app.ml.recommend import rank_courses

# New helpers from your single utils.py
from app.utils import read_text_or_file, get_top_terms

router = APIRouter(prefix="/ml")

# ------------------------ EXISTING ENDPOINTS (unchanged) ------------------------

@router.post("/nlp/extract", response_model=ExtractResponse, summary="Extract skills & role from free text")
async def nlp_extract(req: ExtractRequest):
    cands = extract_skill_candidates(req.text)
    skills = normalize_to_catalog(cands)
    role, score = closest_role(req.text)
    return {"skills": skills, "role_guess": {"role": role, "score": score}}

@router.post("/gap/compute", summary="Compute skill gap between candidate and job")
async def gap_compute(req: GapRequest):
    return compute_skill_gap(set(req.candidate_skills), set(req.job_skills))

@router.post("/recommend/courses", summary="Recommend courses for missing skills")
async def recommend_courses(req: RecommendRequest):
    return {"courses": rank_courses(req.missing_skills)}

# ------------------------ NEW: UPLOAD-FRIENDLY NLP ------------------------------

@router.post(
    "/nlp/extract-doc",
    response_model=ExtractResponse,
    summary="Extract skills & role from PDF/TXT upload or raw text (non-breaking alternate to /nlp/extract)"
)
async def nlp_extract_doc(
    text: Optional[str] = Form(default=None, description="Raw text (optional)"),
    file: Optional[UploadFile] = File(default=None, description="PDF or TXT file (optional)")
):
    try:
        content = await read_text_or_file(text, file)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    cands = extract_skill_candidates(content)
    skills = normalize_to_catalog(cands)
    role, score = closest_role(content)
    return {"skills": skills, "role_guess": {"role": role, "score": score}}

# ------------------------ NEW: GAP FROM DOCS (PDF/TXT or text) ------------------

class GapResponse(BaseModel):
    skills_found: List[str]
    skills_missing: List[str]
    suggestions: List[str]

@router.post(
    "/gap/from-docs",
    response_model=GapResponse,
    summary="Skill gap analysis from resume & job description (PDF/TXT or raw text)"
)
async def gap_from_docs(
    resume_text: Optional[str] = Form(default=None),
    resume_file: Optional[UploadFile] = File(default=None, description="PDF/TXT resume"),
    jd_text: Optional[str] = Form(default=None),
    jd_file: Optional[UploadFile] = File(default=None, description="PDF/TXT job description"),
):
    try:
        resume = await read_text_or_file(resume_text, resume_file)
        jd = await read_text_or_file(jd_text, jd_file)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Extract normalized skills from both docs using your existing pipeline
    cand_resume = normalize_to_catalog(extract_skill_candidates(resume))
    cand_jd = normalize_to_catalog(extract_skill_candidates(jd))

    gap = compute_skill_gap(set(cand_resume), set(cand_jd))
    skills_found = sorted(list(gap["overlap"]))
    skills_missing = sorted(list(gap["missing"]))

    # Course recs for missing skills via your existing recommender
    suggestions = rank_courses(skills_missing)

    return GapResponse(
        skills_found=skills_found,
        skills_missing=skills_missing,
        suggestions=suggestions
    )

# ------------------------ NEW: ANALYZE MULTIPLE JOBS ----------------------------

class AnalyzeJobsRequest(BaseModel):
    jobs: List[str]  # URL or raw JD text

class AnalyzeJobsItem(BaseModel):
    source: str
    skills: List[str]
    role_guess: Dict[str, Any]

class AnalyzeJobsResponse(BaseModel):
    items: List[AnalyzeJobsItem]
    top_terms_overall: List[str]

def _is_url(s: str) -> bool:
    return s.startswith("http://") or s.startswith("https://")

@router.post(
    "/analyze-jobs",
    response_model=AnalyzeJobsResponse,
    summary="Analyze multiple job posts (URLs or raw texts) and return skills + top terms"
)
async def analyze_jobs(payload: AnalyzeJobsRequest):
    items: List[AnalyzeJobsItem] = []
    collected_texts: List[str] = []

    for src in payload.jobs:
        if _is_url(src):
            # TODO: implement proper fetch & clean
            text = f"(stub) fetched from {src}"
        else:
            text = src

        collected_texts.append(text)

        # Use the same skill pipeline as NLP extract
        cands = extract_skill_candidates(text)
        skills = normalize_to_catalog(cands)
        role, score = closest_role(text)

        items.append(AnalyzeJobsItem(
            source=src,
            skills=skills,
            role_guess={"role": role, "score": score}
        ))

    # Global top terms across all provided JDs using your utils.get_top_terms
    top_terms = get_top_terms(collected_texts, top_k=25, use_tfidf=True, include_bigrams=True)

    return AnalyzeJobsResponse(items=items, top_terms_overall=top_terms)
