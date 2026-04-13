from __future__ import annotations

import os, json, re
from typing import Dict, Any, List
from fastapi import APIRouter, File, UploadFile, Body, Query, HTTPException

from app.services.payloads import get_text_from_inputs
from app.services.chutes_client import llm_complete, ChutesError
from app.services.prompt_templates import USR_GAPS, USR_RECOMMEND
# (We intentionally do NOT use USR_EXTRACT_SKILLS so we can force strict-JSON output.)

router = APIRouter(prefix="/api/v1/llm/ml", tags=["llm-ml"])

# ==============================================================
# Helpers
# ==============================================================
MAX_BYTES = 20 * 1024 * 1024  # 20 MB cap

def _ensure_pdf(f: UploadFile, name: str) -> None:
    """Strict PDF guard."""
    if not f:
        raise HTTPException(status_code=400, detail=f"Missing {name}.")
    ctype = (f.content_type or "").lower()
    if ctype != "application/pdf":
        raise HTTPException(415, detail=f"{name} must be a PDF (got {ctype!r}).")

def _ensure_textlike(f: UploadFile, name: str) -> None:
    """Allow only PDF or TXT for extract-skills."""
    if not f:
        raise HTTPException(status_code=400, detail=f"Missing {name}.")
    ctype = (f.content_type or "").lower()
    ok = {"application/pdf", "text/plain"}
    if ctype not in ok:
        raise HTTPException(415, detail=f"{name} must be .pdf or .txt (got {ctype!r}).")

# ---------- canonicalization & taxonomy for skills (extract-skills only) ----------
_ALIAS: Dict[str, str] = {
    "c++": "cpp",
    "react.js": "react",
    "reactjs": "react",
    "nextjs": "next.js",
    "nodejs": "node.js",
    "postgres": "postgresql",
    "ms excel": "excel",
    "powerbi": "power bi",
    "ci/cd": "ci-cd",
    "nlp": "natural language processing",
    "opencv": "open cv",
}

_TAXONOMY: Dict[str, set[str]] = {
    "languages": {"python", "cpp", "c", "java", "javascript", "typescript", "sql", "go", "rust"},
    "frontend": {"react", "next.js", "html", "css", "tailwind", "redux", "vite"},
    "backend": {"node.js", "express", "fastapi", "flask", "django", "spring"},
    "databases": {"postgresql", "mysql", "sqlite", "mongodb", "redis", "supabase"},
    "ml_ai": {
        "machine learning", "deep learning", "pytorch", "tensorflow",
        "scikit-learn", "natural language processing", "computer vision",
        "open cv", "mlops", "model serving", "inference"
    },
    "data_tools": {"pandas", "numpy", "matplotlib", "seaborn", "power bi", "tableau", "excel", "duckdb", "dbt"},
    "cloud_devops": {"docker", "kubernetes", "aws", "gcp", "azure", "github actions", "ci-cd"},
    "security_auth": {"oauth", "jwt", "auth", "authentication", "authorization"},
    "testing_ci": {"pytest", "jest", "playwright", "cypress", "unit testing", "integration testing"},
    "soft_skills": {
        "communication", "leadership", "teamwork", "problem solving",
        "collaboration", "ownership", "mentorship", "continuous learning"
    },
}

def _canon(s: str) -> str:
    s = re.sub(r"\s+", " ", s.strip().lower())
    return _ALIAS.get(s, s)

def _pick_bucket(tok: str) -> str:
    # exact membership
    for bucket, tags in _TAXONOMY.items():
        if tok in tags:
            return bucket
    # substring fallback
    for bucket, tags in _TAXONOMY.items():
        if any(t in tok for t in tags):
            return bucket
    return "other"

def _parse_llm_list(raw: str) -> List[str]:
    """
    Accepts content that may be: pure JSON, code-fenced ```json ...```, or bulleted text.
    Returns a list of strings.
    """
    s = raw.strip()
    m = re.search(r"```json\s*(.*?)\s*```", s, flags=re.S | re.I)
    if m:
        s = m.group(1).strip()
    try:
        data = json.loads(s)
        if isinstance(data, list):
            return [str(x) for x in data]
    except Exception:
        pass
    # fallback: line items
    items = []
    for line in s.splitlines():
        line = re.sub(r"^[-*\d\.\)\s]+", "", line).strip()
        if line:
            items.append(line)
    return items

def _structure_skills(raw_list: List[str]) -> Dict[str, List[str]]:
    seen = set()
    buckets: Dict[str, List[str]] = {k: [] for k in list(_TAXONOMY.keys()) + ["other"]}
    flat: List[str] = []
    for item in raw_list:
        c = _canon(item)
        if not c or c in seen:
            continue
        seen.add(c)
        b = _pick_bucket(c)
        buckets[b].append(c)
        flat.append(c)
    for k in buckets:
        buckets[k].sort()
    return {"buckets": buckets, "flat": flat}

# ==============================================================
# 1️⃣  Extract Skills — Resume only (file-upload only, structured)
# ==============================================================
@router.post(
    "/extract-skills",
    summary="LLM Extract Skills from Resume (file-only — PDF/TXT, structured output)",
)
async def llm_extract_skills(
    file: UploadFile = File(..., description="Upload your résumé (.pdf or .txt only)"),
    ai: int = Query(1),
    temperature: float = Query(0.1, ge=0.0, le=1.0),
    max_tokens: int = Query(400, ge=1, le=4096),
):
    """Accepts a résumé file only — returns categorized, canonicalized skills."""
    _ensure_textlike(file, "file")

    text, meta = await get_text_from_inputs(inline_text=None, file=file)
    if isinstance(meta, dict) and (meta.get("length", 0) or 0) > MAX_BYTES:
        raise HTTPException(413, detail=f"file must be ≤ {MAX_BYTES // (1024 * 1024)} MB.")
    if not text or len(text.strip()) < 40:
        raise HTTPException(400, detail="File text is empty or unreadable.")

    result: Dict[str, Any] = {"mode": "student", "source": meta}

    if ai == 1:
        # force strict JSON array-of-strings from the model
        prompt = (
            "Extract distinct skills / technologies / tools / keywords from the résumé text.\n"
            "Return ONLY a JSON array of strings (no prose, no markdown, no code fences).\n"
            "Be precise: prefer canonical names (e.g., 'postgresql', 'react', 'fastapi', 'docker').\n\n"
            f"RESUME START\n{text[:10000]}\nRESUME END"
        )
        try:
            out = llm_complete(
                messages=[{"role": "user", "content": prompt}],
                temperature=temperature,
                max_tokens=max_tokens,
            )
            raw_list = _parse_llm_list(out)
            structured = _structure_skills(raw_list)
            result["skills"] = structured["buckets"]
            result["keywords_flat"] = structured["flat"]
            result["ai_raw"] = out  # keep while you iterate; remove later if you want
        except ChutesError as e:
            result["ai_error"] = str(e)
        except Exception as e:
            result["ai_error"] = f"Server error: {e}"
    else:
        result["ai_error"] = "LLM disabled; no extraction performed."

    return result


# ==============================================================
# 2️⃣  Compute Gaps — PDF files only (UNCHANGED)
# ==============================================================
@router.post("/compute-gaps", summary="LLM Compute Gaps (PDF files only)")
async def llm_compute_gaps(
    resume_file: UploadFile = File(..., description="Candidate resume (PDF)"),
    role_file:   UploadFile = File(..., description="Target role / Job Description (PDF)"),
    ai: int = Query(1),
    temperature: float = Query(0.2, ge=0.0, le=1.0),
    max_tokens: int = Query(800, ge=1, le=4096),
):
    _ensure_pdf(resume_file, "resume_file")
    _ensure_pdf(role_file, "role_file")

    res_text, meta_res = await get_text_from_inputs(inline_text=None, file=resume_file)
    role_text, meta_role = await get_text_from_inputs(inline_text=None, file=role_file)

    if isinstance(meta_res, dict) and (meta_res.get("length", 1) or 1) > MAX_BYTES:
        raise HTTPException(413, detail=f"resume_file must be ≤ {MAX_BYTES // (1024 * 1024)} MB.")
    if isinstance(meta_role, dict) and (meta_role.get("length", 1) or 1) > MAX_BYTES:
        raise HTTPException(413, detail=f"role_file must be ≤ {MAX_BYTES // (1024 * 1024)} MB.")

    result: Dict[str, Any] = {"source": {"resume": meta_res, "role": meta_role}}

    if ai == 1 and res_text and role_text:
        try:
            out = llm_complete(
                messages=[{
                    "role": "user",
                    "content": USR_GAPS.format(resume_text=res_text[:8000], role_text=role_text[:4000])
                }],
                temperature=temperature,
                max_tokens=max_tokens,
            )
            result["ai"] = out
        except ChutesError as e:
            result["ai_error"] = str(e)
        except Exception as e:
            result["ai_error"] = f"Server error: {e}"
    else:
        if not res_text:
            result["ai_error"] = "Could not extract text from resume_file."
        elif not role_text:
            result["ai_error"] = "Could not extract text from role_file."

    return result


# ==============================================================
# 3️⃣  Recommend Courses — Plain text only (UNCHANGED)
# ==============================================================
@router.post(
    "/recommend",
    summary="LLM Recommend Courses (plain text only)",
)
async def llm_recommend_plaintext(
    gaps: str = Body(
        ...,
        media_type="text/plain",
        description="Describe your goal and gaps in plain sentences.",
        examples=["aiming for data scientist; weak in SQL windows, PyTorch basics, Docker+FastAPI deploy, MLflow; 6 hrs/week for 8 weeks"]
    ),
    ai: int = Query(1, description="Keep as 1 to use LLM path"),
    temperature: float = Query(0.2, ge=0.0, le=1.0),
    max_tokens: int = Query(700, ge=1, le=4096),
):
    if ai != 1:
        raise HTTPException(400, detail="Only ai=1 (LLM path) supported.")
    for envvar in ["CHUTES_API_KEY", "CHUTES_MODEL", "CHUTES_BASE_URL"]:
        if not os.getenv(envvar):
            raise HTTPException(500, detail=f"{envvar} is missing in environment.")

    text = (gaps or "").strip()
    if not text:
        raise HTTPException(422, detail="Empty input.")

    user_prompt = USR_RECOMMEND.format(gaps_text=text[:8000])
    try:
        reply = llm_complete(
            messages=[{"role": "user", "content": user_prompt}],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return {"reply": reply, "model": "chutes", "tokens": {"max": max_tokens}}
    except ChutesError as e:
        raise HTTPException(502, detail=f"LLM error: {e}")
    except Exception as e:
        raise HTTPException(500, detail=f"Server error: {e}")
