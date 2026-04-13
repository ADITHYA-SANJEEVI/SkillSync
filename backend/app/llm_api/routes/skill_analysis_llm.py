# backend/app/llm_api/routes/skill_analysis_llm.py
from __future__ import annotations
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Any, Dict, List, Tuple
from pydantic import BaseModel
from app.services.payloads import get_text_from_inputs
from app.services.prompt_templates import SYS_RESUME, USR_EXTRACT_SKILLS
from app.services.chutes_client import llm_complete, ChutesError
import json, math

router = APIRouter(prefix="/api/v1/llm", tags=["llm-skill-analysis"])

# ---------- helpers ----------

def _safe_json_list(txt: str) -> List[str]:
    try:
        data = json.loads(txt)
        if isinstance(data, list):
            # normalize and dedupe
            seen, out = set(), []
            for s in data:
                if not isinstance(s, str): 
                    continue
                k = s.strip().lower()
                if k and k not in seen:
                    seen.add(k); out.append(k)
            return out[:40]
    except Exception:
        pass
    return []

def _jaccard(base: List[str], target: List[str]) -> float:
    A, B = set(base), set(target)
    if not A and not B: 
        return 0.0
    return len(A & B) / len(A | B)

def _partition(base: List[str], target: List[str]) -> Tuple[List[str], List[str], List[str]]:
    base_set = set(base)
    target_set = set(target)
    strengths = sorted(base_set & target_set)
    missing   = sorted(target_set - base_set)
    extra     = sorted(base_set - target_set)
    # crude partials: substr overlaps
    partial = []
    for t in list(missing):
        for b in base:
            if t != b and (t in b or b in t):
                partial.append(t)
                break
    partial = sorted(set(partial))
    # real missing should exclude partials from display in "missing" if we like
    return strengths, missing, partial, extra

def _radar_series(union_labels: List[str], base: List[str], target: List[str]) -> Dict[str, Any]:
    # 2-line radar: resume vs target (1 if skill present else 0)
    labels = union_labels
    resume_vals = [1 if s in base else 0 for s in labels]
    target_vals = [1 if s in target else 0 for s in labels]
    return {"labels": labels, "series": [
        {"name": "Resume", "data": resume_vals},
        {"name": "Target", "data": target_vals},
    ]}

# ---------- request/response models ----------

class SkillAnalysisResponse(BaseModel):
    skills: List[str]
    match_percentage: float
    strengths: List[str]
    missing: List[str]
    partial: List[str]
    extra: List[str]
    radar: Dict[str, Any]
    blurb: str

# ---------- endpoint ----------

@router.post("/skill-analysis", response_model=SkillAnalysisResponse)
async def skill_analysis(
    file: UploadFile = File(..., description="Resume file (pdf or txt)"),
    job_title: str = Form("", description="Optional job title, empty string allowed"),
) -> Dict[str, Any]:
    # 1) Convert file -> text
    text, meta = await get_text_from_inputs(inline_text=None, file=file)
    if not text.strip():
        raise HTTPException(400, "Could not read any text from the uploaded resume.")

    # 2) Extract resume skills with LLM (strict JSON list)
    try:
        llm_out = llm_complete(messages=[
            {"role": "system", "content": SYS_RESUME},
            {"role": "user", "content": USR_EXTRACT_SKILLS.format(text=text[:20000])},
        ], temperature=0.1, max_tokens=700)
    except ChutesError as e:
        raise HTTPException(502, f"LLM error: {e}")

    resume_skills = _safe_json_list(llm_out)

    # 3) Derive (very) light target set
    target_skills: List[str]
    if job_title.strip():
        # quick heuristic seed list by title keywords
        key = job_title.strip().lower()
        seeds = []
        if "react" in key: seeds += ["react", "typescript", "javascript", "redux", "node.js", "jest", "html", "css"]
        if "python" in key: seeds += ["python", "fastapi", "django", "sql", "pandas", "docker", "aws"]
        if "data" in key: seeds += ["python", "sql", "pandas", "numpy", "scikit-learn", "etl", "spark"]
        if not seeds: seeds = ["communication", "git", "testing", "docker"]
        target_skills = sorted(list(dict.fromkeys(seeds)))[:30]
    else:
        # No target: compare against a neutral “core” basket so radar still renders
        target_skills = ["git", "testing", "docker", "sql", "communication"]

    # 4) Score + partitions
    score = round(_jaccard(resume_skills, target_skills) * 100, 1)
    strengths, missing, partial, extra = _partition(resume_skills, target_skills)

    # 5) Radar (union of top-N labels to keep chart readable)
    union_labels = sorted(list(dict.fromkeys(
        strengths + missing + partial + extra
    )))[:18] or sorted(list(dict.fromkeys(resume_skills + target_skills)))[:18]
    radar = _radar_series(union_labels, resume_skills, target_skills)

    # 6) Blurb
    if job_title.strip():
        blurb = f"Your résumé aligns {score}% with a typical **{job_title.strip()}** profile. Focus on the missing skills to lift alignment."
    else:
        blurb = "Résumé skill snapshot vs a core baseline. Add a target job title to see a focused progress report."

    return {
        "skills": resume_skills,
        "match_percentage": score,
        "strengths": strengths,
        "missing": missing,
        "partial": partial,
        "extra": extra,
        "radar": radar,
        "blurb": blurb,
    }
