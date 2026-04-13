# backend/app/llm_api/routes/match_llm.py
from __future__ import annotations
from typing import Optional, List, Dict, Any
import json, re, string, urllib.parse

from fastapi import APIRouter, HTTPException, File, Form, UploadFile, status

from app.services.chutes_client import llm_complete
from app.services.payloads import get_text_from_inputs

router = APIRouter(prefix="/api/v1/llm", tags=["llm"])

# =========================
# Utilities
# =========================

PUNCT_TABLE = str.maketrans("", "", string.punctuation)

def _normalize(text: str) -> str:
    text = text.lower()
    text = re.sub(r"\s+", " ", text)
    return text.translate(PUNCT_TABLE).strip()

def _json_salvage(s: str) -> Any:
    """Extract JSON object/array from a possibly chatty LLM reply."""
    if not s:
        return None
    s = s.strip()
    try:
        return json.loads(s)
    except Exception:
        pass
    m = re.search(r"```json\s*(\{.*?\}|\[.*?\])\s*```", s, flags=re.S | re.I)
    if not m:
        m = re.search(r"(\{.*\}|\[.*\])", s, flags=re.S)
    if not m:
        return None
    chunk = m.group(1).strip()
    # strip trailing commas
    chunk = re.sub(r",\s*([}\]])", r"\1", chunk)
    try:
        return json.loads(chunk)
    except Exception:
        return None

def _dedupe_keep_order(seq: List[str]) -> List[str]:
    seen, out = set(), []
    for x in seq:
        x = str(x).strip()
        if x and x not in seen:
            seen.add(x)
            out.append(x)
    return out

_CANON = {
    "xgboot": "xgboost",
    "xgbboost": "xgboost",
    "hugging face": "huggingface",
    "restful apis": "rest api",
    "rest apis": "rest api",
    "rest": "rest api",
    "jwt auth": "jwt",
    "node": "node.js",
    "oauth": "oauth2",
}
def _canon_skill(s: str) -> str:
    s = str(s).strip().lower()
    s = re.sub(r"[^a-z0-9 +/#.\-\(\)]", "", s)
    s = re.sub(r"\s+", " ", s)
    return _CANON.get(s, s)

def _cap(seq: List[Any], n: int) -> List[Any]:
    return seq[:n] if n >= 0 else seq

def _score_overlap(resume_skills: List[str], job_skills: List[str]) -> Dict[str, Any]:
    rset, jset = set(resume_skills), set(job_skills)
    overlap = sorted(rset & jset)
    missing = sorted(jset - rset)
    coverage = (len(overlap) / max(1, len(job_skills))) * 100
    density  = (len(overlap) / max(1, len(resume_skills))) * 100
    score    = round(0.7 * coverage + 0.3 * density, 1)
    return {
        "overlap": overlap,
        "missing": missing,
        "coverage_pct": round(coverage, 1),
        "density_pct": round(density, 1),
        "score_pct": score,
    }

def _progress_badge(score: float) -> Dict[str, str]:
    if score >= 75:
        return {"label": "Interview-Ready", "tone": "positive"}
    if score >= 50:
        return {"label": "Getting There", "tone": "warning"}
    return {"label": "Early", "tone": "neutral"}

def _rec_url(title: str) -> str:
    return f"/api/v1/llm/ml/recommend?target_job={urllib.parse.quote(title)}"

# =========================
# LLM helpers (LLM-first only)
# =========================

def _llm_json_or_502(messages: List[Dict[str, str]], *, max_tokens: int) -> Any:
    """
    Call Chutes and require valid JSON. If JSON can't be parsed after two attempts,
    raise HTTP 502 so the client can retry.
    """
    for temp in (0.2, 0.0):
        raw = llm_complete(messages=messages, temperature=temp, max_tokens=max_tokens)
        obj = _json_salvage(raw)
        if obj is not None:
            return obj
    raise HTTPException(status_code=502, detail="LLM returned unparseable output. Please retry.")

def _extract_resume_skills_llm(resume_text: str) -> List[str]:
    prompt = (
        'Return ONLY JSON like: {"skills":[ "...", "..." ]}. '
        "List **12–30** distinct, lowercase skills/technologies present or clearly implied in the résumé. "
        "Prefer canonical names (e.g., 'rest api', 'oauth2', 'xgboost'). Avoid degrees/cert names unless hard skills. "
        "No commentary outside JSON.\n\n"
        f"RESUME:\n{resume_text[:9000]}"
    )
    obj = _llm_json_or_502([{"role": "user", "content": prompt}], max_tokens=380)
    if not isinstance(obj, dict) or not isinstance(obj.get("skills"), list) or not obj["skills"]:
        raise HTTPException(status_code=502, detail="LLM returned empty skills.")
    skills = [_canon_skill(s) for s in obj["skills"] if str(s).strip()]
    return _dedupe_keep_order(skills)

def _infer_roles_llm(resume_text: str) -> List[Dict[str, Any]]:
    """
    Ask LLM for 4–6 best-fit roles with rationale and expected skills (India, 2025).
    Second-person tone for rationale (speaks to the candidate directly).
    """
    prompt = f"""
Return ONLY a JSON array (4–6 items). Each item shape:
{{
  "job_title": "string",
  "rationale": "1–2 sentences in second person explaining why this fits you (reference your strengths succinctly)",
  "expected_skills": ["lowercase canonical skills", "..."]  // 8–12 items
}}
Rules:
- India market, 2025 assumptions. Practical titles (avoid buzzword soup).
- expected_skills must be canonical and technical where possible.
- No extra text outside JSON.

RESUME:
{resume_text[:9000]}
"""
    arr = _llm_json_or_502([{"role": "user", "content": prompt}], max_tokens=800)
    if not isinstance(arr, list) or not arr:
        raise HTTPException(status_code=502, detail="LLM returned no roles.")
    cleaned: List[Dict[str, Any]] = []
    for it in arr:
        if not isinstance(it, dict):
            continue
        title = str(it.get("job_title", "")).strip()
        rationale = str(it.get("rationale", "")).strip()
        skills = it.get("expected_skills", [])
        if title and rationale and isinstance(skills, list) and skills:
            sk = [_canon_skill(s) for s in skills if str(s).strip()]
            cleaned.append({
                "job_title": title,
                "rationale": rationale,
                "expected_skills": _dedupe_keep_order(sk)
            })
    if not cleaned:
        raise HTTPException(status_code=502, detail="LLM roles payload was invalid.")
    return cleaned

def _expected_skills_for_role_llm(role: str) -> List[str]:
    prompt = f"""
Return ONLY JSON like {{"skills":[ "...", "..." ]}} listing **10–14** lowercase, canonical skills
you typically need for the role "{role}" in India (2025).
Prefer concrete implementable skills (frameworks, systems, data stores, tooling). No soft skills.
"""
    obj = _llm_json_or_502([{"role": "user", "content": prompt}], max_tokens=360)
    if not isinstance(obj, dict) or not isinstance(obj.get("skills"), list) or not obj["skills"]:
        raise HTTPException(status_code=502, detail="LLM returned empty role skills.")
    sk = [_canon_skill(s) for s in obj["skills"] if str(s).strip()]
    return _dedupe_keep_order(sk)

def _coaching_pack_llm(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Big, second-person coaching pack. We send a compact JSON context (skills, overlap, missing, scores),
    and the LLM returns a deep plan in JSON. We cap counts for UI hygiene later.
    """
    prompt = f"""
You are a warm, expert Indian tech career coach (2025). Speak in SECOND PERSON ("you", "your").
Return ONLY JSON with these keys (no extra prose):

{{
  "summary": "2–3 energetic sentences telling you where you stand and what to do next (mention score%)",
  "strengths": ["3–6 short bullets highlighting your strongest, market-relevant signals", "..."],
  "risks": ["3–6 concise risks/blind spots recruiters might worry about (no shaming)", "..."],
  "insights": ["3–6 non-obvious observations about your profile vs. the role", "..."],
  "quick_wins": ["3–5 very specific actions tied to missing skills; each shippable in 1–3 days", "..."],
  "project_ideas": ["2–4 compact projects mapped to missing skills with a measurable outcome", "..."],
  "sprint_14_days": [
     {{"day_range":"Days 1–4","focus":"...","deliverable":"...","metric":"..."}},
     {{"day_range":"Days 5–9","focus":"...","deliverable":"...","metric":"..."}},
     {{"day_range":"Days 10–14","focus":"...","deliverable":"...","metric":"..."}}
  ],
  "interview_warmups": ["6–10 targeted practice questions for this role", "..."],
  "keyword_mirrors": ["10–16 JD/ATS phrases to mirror (canonical, lowercase)", "..."],
  "resume_edits": ["3–6 micro-edits to tighten your résumé for this role", "..."],
  "outreach_scripts": ["2–3 short networking/intro scripts you can paste into LinkedIn/email", "..."],
  "reading_list": ["3–6 links/topics to skim (write as plain titles, not URLs)", "..."]
}}

CONTEXT (JSON):
{json.dumps(context, ensure_ascii=False)[:8000]}

Constraints:
- Be crisp and encouraging; no boilerplate, no repetition.
- Drive everything from the top 3 missing skills and the job’s expected skills.
- Use real, verifiable language (no hype). Keep items UI-ready and compact.
"""
    obj = _llm_json_or_502([{"role": "user", "content": prompt}], max_tokens=1400)
    if not isinstance(obj, dict):
        raise HTTPException(status_code=502, detail="LLM coaching pack invalid.")

    # Light normalization/capping for UI polish
    def _cap_list(name: str, lo: int, hi: int):
        lst = obj.get(name, [])
        if isinstance(lst, list):
            obj[name] = _cap([str(x) for x in lst if str(x).strip()], hi)
        else:
            obj[name] = []
    _cap_list("strengths", 3, 6)
    _cap_list("risks", 3, 6)
    _cap_list("insights", 3, 6)
    _cap_list("quick_wins", 3, 5)
    _cap_list("project_ideas", 2, 4)
    _cap_list("interview_warmups", 6, 10)
    _cap_list("keyword_mirrors", 10, 16)
    _cap_list("resume_edits", 3, 6)
    _cap_list("outreach_scripts", 2, 3)
    _cap_list("reading_list", 3, 6)

    s14 = obj.get("sprint_14_days", [])
    if isinstance(s14, list):
        cleaned = []
        for x in s14[:3]:
            if isinstance(x, dict):
                cleaned.append({
                    "day_range": str(x.get("day_range", "")),
                    "focus": str(x.get("focus", "")),
                    "deliverable": str(x.get("deliverable", "")),
                    "metric": str(x.get("metric", "")),
                })
        obj["sprint_14_days"] = cleaned
    else:
        obj["sprint_14_days"] = []

    return obj

# =========================
# API: POST /llm/match (LLM-first, second-person)
# =========================

@router.post(
    "/match",
    summary="Match your résumé to best-fit roles (PDF only). Optional job_name for a focused, second-person coaching report."
)
async def llm_match(
    file: UploadFile = File(..., media_type="application/pdf", description="Upload your résumé as PDF"),
    job_name: Optional[str] = Form(None, description="Optional: name a target role (e.g., 'full-stack developer (react + fastapi)')")
):
    # Validate PDF
    if not file:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="file is required")
    if file.content_type not in (
        "application/pdf", "application/x-pdf", "application/acrobat", "applications/pdf", "text/pdf", "text/x-pdf"
    ):
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Only PDF resumes are accepted")

    # Extract text
    text, meta = await get_text_from_inputs(inline_text=None, file=file)
    if not text or len(text.strip()) < 40:
        raise HTTPException(status_code=400, detail="Could not read text from the uploaded PDF")

    # 1) Resume skills via LLM
    resume_skills = _extract_resume_skills_llm(text)
    resume_profile = {
        "skill_count": len(resume_skills),
        "skills": resume_skills,
        "notes": "We inferred skills from your résumé text. Add explicit keywords in project bullets for stronger recall."
    }

    # ---------- TARGET MODE (job_name provided) ----------
    if job_name:
        target_title = job_name.strip()

        # 2) Expected skills for target (LLM)
        job_skills = _expected_skills_for_role_llm(target_title)

        # 3) Deterministic overlap score
        sc = _score_overlap(resume_skills, job_skills)
        badge = _progress_badge(sc["score_pct"])

        # 4) Second-person coaching pack
        context = {
            "target_role": target_title,
            "resume_skills": resume_skills,
            "expected_skills": job_skills,
            "overlap": sc["overlap"],
            "missing": sc["missing"],
            "score_pct": sc["score_pct"],
            "coverage_pct": sc["coverage_pct"],
            "density_pct": sc["density_pct"],
        }
        coaching = _coaching_pack_llm(context)

        return {
            "mode": "student",
            "ui": {
                "headline": f"You aiming for **{target_title}**",
                "badge": badge,
                "cta": "Knock out the quick wins, follow the sprint, and re-run Match."
            },
            "source": meta,
            "resume_profile": resume_profile,
            "target_request": {"job_name": target_title},
            "target_report": {
                "job_title": target_title,
                **sc,
                "expected_skills": job_skills,
                "recommend_url": _rec_url(target_title),
                "reason": "Focused progress report for your chosen role"
            },
            "guidance": coaching,  # second-person, very detailed
            "tip": "Prefer discovery? Re-run without job_name to see your top matches."
        }

    # ---------- DISCOVERY MODE (no job_name) ----------
    # 2) Ask LLM for 4–6 best-fit roles with second-person rationale + expected skills
    roles = _infer_roles_llm(text)

    # 3) Score each role deterministically
    ranked: List[Dict[str, Any]] = []
    for role in roles:
        sc = _score_overlap(resume_skills, role.get("expected_skills", []))
        ranked.append({
            "job_title": role.get("job_title", "unknown role"),
            "rationale": role.get("rationale", ""),  # already second-person
            **sc,
            "expected_skills": role.get("expected_skills", []),
            "reason": "LLM-inferred role; scored by skill overlap",
            "recommend_url": _rec_url(role.get("job_title", "")),
            "badge": _progress_badge(sc["score_pct"])
        })

    ranked.sort(key=lambda r: r["score_pct"], reverse=True)
    best_fit = ranked[0] if ranked else None
    if not best_fit:
        raise HTTPException(status_code=502, detail="LLM could not infer roles. Please retry with a clearer résumé.")

    # 4) Second-person coaching for the top role
    context = {
        "target_role": best_fit["job_title"],
        "resume_skills": resume_skills,
        "expected_skills": best_fit["expected_skills"],
        "overlap": best_fit["overlap"],
        "missing": best_fit["missing"],
        "score_pct": best_fit["score_pct"],
        "coverage_pct": best_fit["coverage_pct"],
        "density_pct": best_fit["density_pct"],
    }
    coaching = _coaching_pack_llm(context)

    return {
        "mode": "student",
        "ui": {
            "headline": "Your best-fit roles (ranked)",
            "badge": _progress_badge(best_fit["score_pct"]),
            "cta": "Open the top match, run the sprint, and come back stronger."
        },
        "source": meta,
        "resume_profile": resume_profile,
        "matches": ranked,
        "best_fit": best_fit,
        "guidance": coaching,
        "tip": "Want a focused score for a specific role? Re-run Match with job_name."
    }

