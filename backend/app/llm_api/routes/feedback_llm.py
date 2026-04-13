from __future__ import annotations
from fastapi import APIRouter, File, UploadFile, HTTPException
from typing import Dict, Any, List, Optional
from app.services.payloads import get_text_from_inputs
from app.services.chutes_client import llm_complete, ChutesError
from app.services.prompt_templates import SYS_RESUME
import json, re

router = APIRouter(prefix="/api/v1/llm/feedback", tags=["llm-feedback"])

# ---------- helpers ----------

MAX_BYTES = 20 * 1024 * 1024  # 20 MB cap

def _ensure_textlike(f: UploadFile) -> None:
    if not f:
        raise HTTPException(400, "Missing file.")
    ctype = (f.content_type or "").lower()
    if ctype not in {"application/pdf", "text/plain"}:
        raise HTTPException(415, detail=f"Only .pdf or .txt supported (got {ctype!r}).")

def _strip_code_fences(s: str) -> str:
    """Extract JSON from ```json ... ``` or return as-is."""
    if not s:
        return s
    m = re.search(r"```json\s*(.*?)\s*```", s, flags=re.S | re.I)
    if m:
        return m.group(1).strip()
    m2 = re.search(r"```\s*(\{.*?\})\s*```", s, flags=re.S)
    return (m2.group(1).strip() if m2 else s.strip())

def _try_load_json(s: str) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(s)
    except Exception:
        return None

def _fallback_markdown_report(resume_text: str) -> str:
    """If JSON parsing fails, we still want to show a readable report."""
    return f"""**ATS Score:** ~70/100

### 🟢 Strengths
- Good technical breadth and relevant academic projects.
- Clear focus areas and evidence of hands-on work.

### 🔴 Weaknesses / Missing Areas
- Limited quantified outcomes; add metrics (accuracy, time saved, users).
- Certifications and impact statements can be tightened.

### 🧭 Improvement Roadmap
1) Add 2–3 metrics to each project (e.g., “+8% F1 vs. baseline”).
2) Front-load a one-line profile headline tailored to a target role.
3) Reorder sections to lead with impact; move older items down.

### 💡 Recruiter’s Take
Solid student résumé with potential. With clearer outcomes and sharper keywords, it will pass most initial screens.

*(Auto-fallback preview rendered because model didn’t return the expected JSON.)*
"""

# ---------- route ----------

@router.post("/resume-score", summary="Upload résumé for detailed AI evaluation (structured JSON)")
async def llm_resume_score(
    file: UploadFile = File(..., description="Upload your résumé as .pdf or .txt")
):
    """
    Candidate-only endpoint.

    - Accepts a resume file only (.pdf or .txt)
    - Extracts text via existing helpers
    - Asks LLM for *strict JSON* so the UI can render sections cleanly
    - Graceful fallback to readable markdown if JSON parse fails
    """
    _ensure_textlike(file)

    resume_text, meta = await get_text_from_inputs(inline_text=None, file=file)
    if not isinstance(meta, dict) or (meta.get("length", 0) or 0) > MAX_BYTES:
        raise HTTPException(413, detail=f"File must be ≤ {MAX_BYTES // (1024*1024)} MB.")
    if not resume_text or len(resume_text.strip()) < 50:
        raise HTTPException(400, detail="Résumé text is empty or unreadable.")

    # --- Strict JSON prompt (UI-friendly) ---
    # We ask the model to return a JSON object ONLY, no prose, with clear fields.
    user_prompt = f"""
You are an expert technical recruiter and ATS optimizer in India.
Analyze the résumé below and return **ONLY** a JSON object with this schema:

{{
  "ats_score": <integer 0-100>,
  "strengths": [ "..." ],
  "weaknesses": [ "..." ],
  "roadmap": [ "..." ],
  "recruiter_take": "...",
  "suggested_headline": "...",
  "keyword_hits": [ "..." ],
  "length_words": <integer>
}}

Guidelines:
- Tailor to **student/early-career** context; India-first.
- "ats_score" should reflect clarity, keyword alignment, and readability.
- "suggested_headline": a one-liner summary the candidate can put at the top.
- "keyword_hits": shortlist of 8–15 ATS-friendly keywords to mirror.
- Use actionable, specific bullets in strengths/weaknesses/roadmap.
- Keep strings concise; avoid markdown or extra commentary.
- Do not include any fields other than those specified.

RESUME TEXT START
{resume_text[:10000]}
RESUME TEXT END
""".strip()

    try:
        raw = llm_complete(
            messages=[
                {"role": "system", "content": SYS_RESUME},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.25,
            max_tokens=900,
        )
    except ChutesError as e:
        raise HTTPException(status_code=502, detail=f"LLM request failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {e}")

    # --- Parse JSON robustly; fallback to markdown report if needed ---
    cleaned = _strip_code_fences(raw or "")
    parsed = _try_load_json(cleaned)

    if parsed and isinstance(parsed, dict):
        # light post-validate & clamp
        ats = parsed.get("ats_score")
        if isinstance(ats, (int, float)):
            parsed["ats_score"] = max(0, min(100, int(round(ats))))
        else:
            parsed["ats_score"] = 70

        # coerce list fields
        for k in ("strengths", "weaknesses", "roadmap", "keyword_hits"):
            v = parsed.get(k)
            if not isinstance(v, list):
                parsed[k] = [str(v)] if v else []

        # recruiter_take / headline
        for k in ("recruiter_take", "suggested_headline"):
            v = parsed.get(k)
            parsed[k] = str(v).strip() if v else ""

        # length_words sanity
        lw = parsed.get("length_words")
        if not isinstance(lw, int):
            parsed["length_words"] = len(resume_text.split())

        return {
            "mode": "student",
            "source": meta,
            "ai": parsed,                 # structured JSON for UI
            "raw": raw.strip(),          # raw model text (debug/observability)
        }

    # JSON parse failed — return readable markdown as fallback
    return {
        "mode": "student",
        "source": meta,
        "ai_markdown": (raw.strip() if raw and raw.strip() else _fallback_markdown_report(resume_text)),
        "note": "Returned markdown because model did not produce valid JSON."
    }
