# app/llm_api/routes/jobs_llm.py
from __future__ import annotations

from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from datetime import date, datetime
from zoneinfo import ZoneInfo
import os, re, traceback, run_llm

# =========================================================
# Helpers
# =========================================================
IST = ZoneInfo("Asia/Kolkata")

def _normalize(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())

def _now_ist_iso() -> str:
    return datetime.now(IST).isoformat()

def _role_canonical(raw: str) -> str:
    """
    Map common aliases/short-hands to canonical role names
    to stabilize the baseline selection and the LLM prompt.
    """
    t = _normalize(raw)

    # quick alias map
    aliases = [
        (r"\bpython\s+(dev|developer|engineer)\b", "Python Developer"),
        (r"\bbackend\b|\bback[-\s]?end\b", "Software Engineer (Backend)"),
        (r"\bfrontend\b|\bfront[-\s]?end\b|\breact\b", "Software Engineer (Frontend)"),
        (r"\bfull[-\s]?stack\b", "Full-Stack Engineer"),
        (r"\bdata\s+analyst\b", "Data Analyst"),
        (r"\bml\s+engineer\b|\bmachine\s+learning\s+engineer\b", "Machine Learning Engineer"),
        (r"\bdata\s+engineer\b", "Data Engineer"),
        (r"\bdevops\b|\bsite\s+reliability\b|\bsre\b", "DevOps Engineer"),
        (r"\bandroid\b", "Android Developer"),
        (r"\bios\b|\biphone\b|\bswift\b", "iOS Developer"),
        (r"\bdjango\b|flask\b|fastapi\b", "Software Engineer (Backend)"),
        (r"\btypescript\b|\bnext\.?js\b", "Software Engineer (Frontend)"),
    ]
    for pat, canon in aliases:
        if re.search(pat, t):
            return canon

    # default tidy casing
    return raw.strip().title() if raw else "Software Engineer"

def _llm_complete(prompt: str, max_tokens: int = 950) -> Optional[str]:
    """Use Chutes LLM with graceful fallback."""
    try:
        return run_llm.complete(
            prompt=prompt,
            system=(
                "You are a top-tier **Indian career market strategist** for students and early-career candidates. "
                "Be precise, current (2025), and India-first. Use crisp Markdown sections. "
                "Avoid generic fluff and disclaimers."
            ),
            max_tokens=max_tokens,
            temperature=0.35
        )
    except Exception as e:
        print(f"[ERROR] LLM completion failed: {e}")
        traceback.print_exc()
        return None

# =========================================================
# Static dataset for fallback (coarse but helpful)
# =========================================================
_BASE = {
    "Data Analyst": {
        "demand": 72,
        "remote": 35,
        "sal": (4.5, 9.0),
        "core": ["sql", "python", "power bi", "excel"],
        "nice": ["tableau", "statistics", "pandas"],
    },
    "Software Engineer (Frontend)": {
        "demand": 66,
        "remote": 45,
        "sal": (6.0, 14.0),
        "core": ["react", "typescript", "git"],
        "nice": ["next.js", "testing library", "ci/cd"],
    },
    "Software Engineer (Backend)": {
        "demand": 70,
        "remote": 30,
        "sal": (5.5, 12.0),
        "core": ["python", "sql", "git"],
        "nice": ["docker", "kubernetes", "fastapi"],
    },
    "Full-Stack Engineer": {
        "demand": 68,
        "remote": 40,
        "sal": (6.0, 13.5),
        "core": ["javascript", "react", "node.js"],
        "nice": ["next.js", "docker", "postgresql"],
    },
    "Python Developer": {
        "demand": 70,
        "remote": 30,
        "sal": (5.5, 12.0),
        "core": ["python", "sql", "git"],
        "nice": ["fastapi", "docker", "pandas"],
    },
    "Machine Learning Engineer": {
        "demand": 64,
        "remote": 35,
        "sal": (7.0, 16.0),
        "core": ["python", "pytorch", "mlops"],
        "nice": ["tensorflow", "scikit-learn", "dagster"],
    },
    "Data Engineer": {
        "demand": 62,
        "remote": 25,
        "sal": (6.0, 14.5),
        "core": ["sql", "python", "airflow"],
        "nice": ["spark", "dbt", "kafka"],
    },
    "DevOps Engineer": {
        "demand": 60,
        "remote": 30,
        "sal": (6.0, 14.0),
        "core": ["docker", "kubernetes", "ci/cd"],
        "nice": ["aws", "terraform", "prometheus"],
    },
}

def _nearest_base(role: str) -> str:
    r = _role_canonical(role)
    # pick closest key by substring
    for k in _BASE.keys():
        if k.lower() in r.lower() or r.lower() in k.lower():
            return k
    # fallback: pick a sensible default
    if "front" in r.lower():
        return "Software Engineer (Frontend)"
    if "back" in r.lower():
        return "Software Engineer (Backend)"
    if "python" in r.lower():
        return "Python Developer"
    return "Software Engineer (Backend)"

# =========================================================
# Response model
# =========================================================
class AnalyzeJobsResponse(BaseModel):
    mode: str
    result: Dict[str, Any]

# =========================================================
# Dense prompt template (LLM brief)
# =========================================================
PROMPT_TEMPLATE = """Generate a **structured job-market brief** for the role:
**{ROLE}** — India context — Date: {DATE}

Return **clean Markdown** with **exactly these 10 sections**:

### Market Snapshot
- Demand level (1–100), competition, remote openness (%), typical companies hiring now.

### Salary Bands (LPA)
- Junior, Mid, Senior ranges (state approximate figures for metro India); add note if city affects range.

### Core Skills (with prevalence %)
- Top 6–8 skills/tools with estimated prevalence % in current JDs.

### Nice-to-Have & Edge Signals
- 5–8 items that create an edge (frameworks, platforms, domain exposure).

### Emerging Trends & Tools
- 4–6 concrete trends (e.g., “LLM retrieval,” “server actions,” etc.). Be specific.

### Interview Patterns
- Common rounds & focus areas (2–4 bullets), quick prep advice.

### ATS & Keywords To Mirror
- 10–15 keywords/phrases to reuse in resumes for this role (comma separated).

### Résumé Tailoring (examples)
- 3–5 bullets showing **before → after** phrasing improvements for this role.

### Portfolio Project Idea
- 1–2 compact, high-signal project ideas with deliverables & metrics.

### 30/60/90 Plan
- Outcome-based plan with weekly focus & checkpoints.

Notes:
- Keep it practical, Indian market first.
- Use crisp bullets; no generic filler, no disclaimers.
"""

# =========================================================
# Core role analyzer
# =========================================================
def _analyze_role(role: str) -> Dict[str, Any]:
    base_key = _nearest_base(role)
    base = _BASE[base_key]

    # baseline stats
    core = [{"name": s, "prevalence": round(0.6 + i * 0.08, 2)} for i, s in enumerate(base["core"][:5])]
    nice = [{"name": s, "prevalence": round(0.25 + i * 0.07, 2)} for i, s in enumerate(base["nice"][:5])]
    sal_min, sal_max = base["sal"]

    result: Dict[str, Any] = {
        "role": _role_canonical(role),
        "demand_index": base["demand"],
        "competition": "Medium" if base["demand"] >= 55 else "Low",
        "salary_band": {"min": sal_min, "max": sal_max, "unit": "LPA", "confidence": 0.7},
        "remote_openness_pct": base["remote"],
        "experience_mode_years": "0-2" if "analyst" in base_key.lower() else "1-3",
        "core_skills": core,
        "nice_to_have": nice,
        "confidence": "High",
        "last_updated": _now_ist_iso(),  # IST timestamp
    }

    # LLM brief (Markdown)
    try:
        prompt = PROMPT_TEMPLATE.format(ROLE=result["role"], DATE=date.today().isoformat())
        brief_md = _llm_complete(prompt, max_tokens=950)
        if brief_md and brief_md.strip():
            result["brief_md"] = brief_md.strip()
            # keep legacy field name too for any UI wired to it
            result["llm_summary"] = brief_md.strip()
        else:
            result["brief_md"] = "⚠️ LLM returned no content; showing baseline only."
            result["llm_summary"] = result["brief_md"]
    except Exception as e:
        result["brief_md"] = f"⚠️ LLM error: {e}"
        result["llm_summary"] = result["brief_md"]

    return result

# =========================================================
# FastAPI route (Candidate-only)
# =========================================================
router = APIRouter(prefix="/api/v1/llm", tags=["llm"])

@router.post(
    "/analyze-jobs",
    response_model=AnalyzeJobsResponse,
    summary="Analyze job role (Candidate-only, plain text body)"
)
def llm_analyze_jobs(role_name: str = Body(..., media_type="text/plain", embed=False)):
    """
    Candidate-only endpoint.
    Accepts **text/plain** job title.
    Example:
      POST /api/v1/llm/analyze-jobs
      Body: "Python Developer"
    Returns a full LLM-generated market brief + baseline stats.
    """
    role = (role_name or "").strip()
    if not role:
        raise HTTPException(400, "Body must contain a non-empty job title.")
    return {"mode": "student", "result": _analyze_role(role)}
