# backend/app/api/analyze_jobs.py
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime
import os, re

# ---------- helpers ----------
def _normalize(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())

def _llm_available() -> bool:
    try:
        import run_llm
        return bool(os.getenv("CHUTES_BASE_URL")) and bool(os.getenv("CHUTES_API_KEY"))
    except Exception:
        return False

def _llm_complete(prompt: str, max_tokens: int = 300) -> Optional[str]:
    try:
        import run_llm
        return run_llm.complete(prompt=prompt, max_tokens=max_tokens)
    except Exception:
        return None

# ---------- seed data ----------
_BASE = {
  "data analyst": {"demand":72,"remote":35,"sal":(4.5,9.0),
                   "core":["sql","python","power bi","excel"],"nice":["tableau","statistics","pandas"]},
  "frontend engineer": {"demand":66,"remote":45,"sal":(6.0,14.0),
                        "core":["react","typescript","git"],"nice":["next.js","testing library","ci/cd"]},
  "software engineer": {"demand":70,"remote":30,"sal":(5.5,12.0),
                        "core":["python","sql","git"],"nice":["docker","kubernetes","fastapi"]},
}

# ---------- request/response models ----------
class AnalyzeJobsRequest(BaseModel):
    role_name: str = Field(..., description="Job title to analyze (e.g., 'Data Analyst', 'Frontend Engineer').")
    location: Optional[str] = Field(None, description="Optional city/region (e.g., 'Chennai').")

class AnalyzeJobsResponse(BaseModel):
    mode: str
    result: Dict[str, Any]

# ---------- core ----------
def _analyze_role(role: str, loc: Optional[str]) -> Dict[str, Any]:
    key = _normalize(role)
    base = None
    for k in _BASE:
        if k in key:
            base = _BASE[k]
            role = k.title()
            break
    if base is None:
        base = _BASE["software engineer"]
        role = role.title()

    core = [{"name": s, "prevalence": round(0.6 + i * 0.1, 2)} for i, s in enumerate(base["core"][:3])]
    nice = [{"name": s, "prevalence": round(0.25 + i * 0.08, 2)} for i, s in enumerate(base["nice"][:3])]
    sal_min, sal_max = base["sal"]

    out = {
        "role": role,
        "location": loc,
        "demand_index": base["demand"],
        "competition": "Medium" if base["demand"] >= 55 else "Low",
        "salary_band": {"min": sal_min, "max": sal_max, "unit": "LPA", "confidence": 0.7},
        "remote_openness_pct": base["remote"],
        "experience_mode_years": "0-2" if "analyst" in role.lower() else "1-3",
        "core_skills": core,
        "nice_to_have": nice,
        "trending_tools": [{"name": "dbt", "trend": "rising"}, {"name": "DuckDB", "trend": "rising"}],
        "common_constraints": ["Weekday office hours", "Immediate joiners preferred"],
        "ats_tips": [
            "Mirror phrasing (e.g., 'Power BI dashboards').",
            "Quantify outcomes (e.g., 'automated monthly report, -4 hrs/wk').",
            "Use both 'data cleaning' and 'data wrangling'."
        ],
        "pathways": [
            "Build a small portfolio project aligned to the role.",
            "Earn an entry certificate (SQL, React, or Cloud).",
            "Write a concise STAR-format project summary."
        ],
        "confidence": "High",
        "last_updated": datetime.utcnow().isoformat() + "Z"
    }

    if _llm_available():
        region = loc or "India"
        s = _llm_complete(
            "You are a career advisor in India. "
            f"Summarize the job market for '{out['role']}' in {region} in 3 bullets: "
            "demand (industries/cities), salary range (LPA) for 0–3 yrs, and top skills (hard+soft). "
            "Each bullet under 25 words.",
            max_tokens=150
        )
        if s:
            out["llm_summary"] = s

    return out

# ---------- route ----------
router = APIRouter(prefix="/api/v1/llm", tags=["llm"])

@router.post("/analyze-jobs", response_model=AnalyzeJobsResponse, summary="Analyze job role (Candidate-only)")
def analyze_jobs(req: AnalyzeJobsRequest):
    """
    Candidate-only: type a job title (optional location) → get market snapshot:
    demand, salary bands (LPA), key skills, and quick pathways. Clean JSON body, no file upload.
    """
    role = (req.role_name or "").strip()
    if not role:
        raise HTTPException(400, "Provide a valid 'role_name'.")
    return {"mode": "student", "result": _analyze_role(role, req.location)}
