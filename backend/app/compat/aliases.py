from __future__ import annotations
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Body, Query, File, UploadFile, Form

# NEW: use the plain-text prompt function instead of llm_chat
from app.llm_api.routes.ai_llm import llm_prompt_plaintext
from app.llm_api.routes.feedback_llm import llm_resume_score
from app.llm_api.routes.ml_llm import llm_extract_skills, llm_compute_gaps, llm_recommend
from app.llm_api.routes.jobs_llm import llm_analyze_jobs
from app.llm_api.routes.match_llm import llm_match
from app.llm_api.routes.uploads_llm import llm_upload_resume

router = APIRouter(prefix="/api/v1", tags=["compat"])

@router.get("/health", summary="Health V1")
def health_v1():
    return {"ok": True, "service": "job-gap-fsd", "v": 1}

# ---------- Chat (alias -> plain-text prompt) ----------
@router.post("/ai/chat", summary="Chat (alias to /api/v1/llm/prompt — text/plain only)")
def chat_with_chutes_alias(
    prompt: str = Body(
        ...,
        media_type="text/plain",
        description="Type your prompt here as plain text (no JSON)."
    ),
    temperature: float = Query(0.2, ge=0.0, le=1.0),
    max_tokens: int = Query(800, ge=1, le=4096),
):
    # delegate to the new plain-text endpoint
    return llm_prompt_plaintext(prompt=prompt, temperature=temperature, max_tokens=max_tokens)

# ---------- Jobs analyze (alias) ----------
@router.post("/analyze-jobs", summary="Analyze Jobs (alias)")
async def analyze_jobs_alias(text: Optional[str] = Form(None),
                             file: Optional[UploadFile] = File(None),
                             json_text: Optional[str] = Body(None),
                             ai: int = Query(1)):
    return await llm_analyze_jobs(text=text, file=file, json_text=json_text, ai=ai)

# ---------- Resume score (alias) ----------
@router.post("/feedback/resume-score", summary="Resume score (.txt/.pdf or text) (alias)")
async def resume_score_alias(text: Optional[str] = Form(None),
                             file: Optional[UploadFile] = File(None),
                             json_text: Optional[str] = Body(None),
                             ai: int = Query(1)):
    return await llm_resume_score(text=text, file=file, json_text=json_text, ai=ai)

# ---------- Match (alias) ----------
@router.post("/match", summary="Match resume to jobs (alias)")
async def match_alias(resume_text: Optional[str] = Form(None),
                      resume_file: Optional[UploadFile] = File(None),
                      jobs_text: Optional[str] = Form(None),
                      jobs_file: Optional[UploadFile] = File(None),
                      json_resume: Optional[str] = Body(None),
                      json_jobs: Optional[str] = Body(None),
                      ai: int = Query(1)):
    return await llm_match(resume_text=resume_text, resume_file=resume_file,
                           jobs_text=jobs_text, jobs_file=jobs_file,
                           json_resume=json_resume, json_jobs=json_jobs, ai=ai)

# ---------- ML helpers (aliases) ----------
@router.post("/ml/extract-skills", summary="Extract Skills (.txt/.pdf or text) (alias)")
async def extract_skills_alias(text: Optional[str] = Form(None),
                               file: Optional[UploadFile] = File(None),
                               json_text: Optional[str] = Body(None),
                               ai: int = Query(1)):
    return await llm_extract_skills(text=text, file=file, json_text=json_text, ai=ai)

@router.post("/ml/compute-gaps", summary="Compute Gaps (alias)")
async def compute_gaps_alias(resume_text: Optional[str] = Form(None),
                             resume_file: Optional[UploadFile] = File(None),
                             role_text: Optional[str] = Form(None),
                             role_file: Optional[UploadFile] = File(None),
                             json_resume: Optional[str] = Body(None),
                             json_role: Optional[str] = Body(None),
                             ai: int = Query(1)):
    return await llm_compute_gaps(resume_text=resume_text, resume_file=resume_file,
                                  role_text=role_text, role_file=role_file,
                                  json_resume=json_resume, json_role=json_role, ai=ai)

@router.post("/ml/recommend", summary="Recommend Courses (alias)")
async def recommend_courses_alias(gaps_text: Optional[str] = Form(None),
                                  json_gaps: Optional[str] = Body(None),
                                  ai: int = Query(1)):
    return await llm_recommend(gaps_text=gaps_text, json_gaps=json_gaps, ai=ai)

# ---------- Upload (alias) ----------
@router.post("/upload-resume", summary="Upload Resume (.txt/.pdf) or inline text – saves to backend/uploads (alias)")
async def upload_resume_alias(text: Optional[str] = Form(None),
                              file: Optional[UploadFile] = File(None),
                              json_text: Optional[str] = Body(None)):
    return await llm_upload_resume(text=text, file=file, json_text=json_text)
