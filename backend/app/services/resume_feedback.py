from __future__ import annotations
"""
Resume feedback utilities used by /api/v1/feedback endpoints.

Exports (stable API):
- score_resume(resume_text: str, resume_skills: list[str] | None, years_exp: float) -> dict
- suggest_missing_skills(resume_text: str, resume_skills: list[str], target_role: str | None, jobs: list[str]) -> dict
"""

from typing import List, Optional, Dict, Tuple
import re, json
from pathlib import Path
from rapidfuzz import process, fuzz

# ----------------------------
# Data: taxonomy & role hints
# ----------------------------
DATA_DIR = Path(__file__).resolve().parents[1] / "data"
TAX_PATH = DATA_DIR / "skills_taxonomy.json"

# Load taxonomy (fallback to a compact default if file is missing)
if TAX_PATH.exists():
    TAXONOMY: List[str] = json.loads(TAX_PATH.read_text(encoding="utf-8"))
else:
    TAXONOMY = [
        "python","pandas","numpy","scikit-learn","xgboost","tensorflow","pytorch","sql",
        "docker","kubernetes","aws","gcp","azure","mlops","nlp","computer vision","git","linux","spark"
    ]

# Minimal role → skill hints (extend this as needed)
ROLE_HINTS: Dict[str, List[str]] = {
    "machine learning engineer": [
        "python","scikit-learn","xgboost","tensorflow","pytorch","feature engineering",
        "mlops","docker","aws","sql","model deployment","monitoring"
    ],
    "data scientist": [
        "python","pandas","numpy","sql","statistics","scikit-learn","xgboost",
        "visualization","experiment design","mlops"
    ],
    "ml ops": [
        "docker","kubernetes","mlops","aws","gcp","azure","git","ci/cd","monitoring","python"
    ],
}

# ----------------------------
# Utils
# ----------------------------
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")

def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()

def _word_count(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text))

def _section_presence(text: str) -> Dict[str, bool]:
    t = text.lower()
    return {
        "summary": any(k in t for k in ("summary", "objective", "profile")),
        "skills":  any(k in t for k in ("skills", "technical skills")),
        "exp":     any(k in t for k in ("experience", "work experience", "projects", "employment")),
        "edu":     any(k in t for k in ("education", "bachelor", "master", "b.tech", "btech", "m.tech", "bsc", "msc")),
        "links":   any(k in t for k in ("github.com", "linkedin.com", "portfolio", "kaggle.com")),
        "contact": bool(_EMAIL_RE.search(t)),
    }

def _normalize_skills(skills: List[str]) -> List[str]:
    # Case-fold & de-duplicate while keeping stable order
    seen = set()
    out = []
    for s in skills or []:
        k = s.strip().lower()
        if not k: 
            continue
        if k not in seen:
            out.append(k)
            seen.add(k)
    return out

def _extract_skills(text: str, threshold: int = 90) -> List[str]:
    """Fuzzy match against TAXONOMY; returns lowercase unique skills."""
    text_low = text.lower()
    found = set()
    for s in TAXONOMY:
        # fuzz.partial_ratio tends to work best for resumes
        score = process.extractOne(s, [text_low], scorer=fuzz.partial_ratio)[1]
        if score >= threshold:
            found.add(s.lower())
    return sorted(found)

# ----------------------------
# Scoring helpers
# ----------------------------
def _length_score(words: int) -> float:
    """350–800 words sweet spot; gentle decay outside."""
    if words <= 100: return 10
    if words >= 1500: return 40
    if words < 350:   return 10 + (words-100) * (30/250)   # 10→40
    if words <= 800:  return 40 + (words-350) * (40/450)   # 40→80
    return 80 - (words-800) * (30/700)                     # 80→50

def _section_score(p: Dict[str,bool]) -> float:
    base = 0.0
    base += 10 if p["summary"] else 0
    base += 25 if p["skills"]  else 0
    base += 25 if p["exp"]     else 0
    base += 15 if p["edu"]     else 0
    base += 10 if p["links"]   else 0
    base += 15 if p["contact"] else 0
    return base  # 0–100

def _keyword_density_score(n_unique_skills: int) -> float:
    # reward mentioning ~4–12 distinct relevant skills
    if n_unique_skills == 0: return 20
    if n_unique_skills >= 12: return 85
    return 30 + min(55, n_unique_skills * 4.5)

# ----------------------------
# Public functions
# ----------------------------
def score_resume(
    resume_text: str,
    resume_skills: Optional[List[str]],
    years_exp: float,
    *,
    fuzzy_threshold: int = 90,
    weights: Tuple[float, float, float, float] = (0.30, 0.40, 0.25, 0.05),
) -> Dict:
    """
    Compute a 0–100 resume score and give actionable recommendations.

    Args:
        resume_text: Full raw text from the resume parser.
        resume_skills: Optional list of skills already detected elsewhere.
        years_exp: Years of experience (float).
        fuzzy_threshold: Fuzzy match threshold used for skill extraction.
        weights: (length, sections, skill_density, experience_bonus) weights.

    Returns:
        dict with keys: score, breakdown{...}, recommendations[list[str]]
    """
    text = _clean(resume_text)
    words = _word_count(text)
    sect = _section_presence(text)

    detected = _extract_skills(text, threshold=fuzzy_threshold)
    merged = _normalize_skills((resume_skills or []) + detected)

    length = _length_score(words)
    sections = _section_score(sect)
    density = _keyword_density_score(len(merged))
    exp_bonus = min(10.0, max(0.0, years_exp) * 1.5)

    w_len, w_sec, w_den, w_exp = weights
    total = w_len*length + w_sec*sections + w_den*density + w_exp*exp_bonus
    total = round(min(100.0, total), 1)

    return {
        "score": total,
        "breakdown": {
            "length_score": round(length, 1),
            "section_score": round(sections, 1),
            "skill_density_score": round(density, 1),
            "experience_bonus": round(exp_bonus, 1),
            "words": words,
            "sections_found": sect,
            "skills_detected": merged[:50],
            "weights": {"length": w_len, "sections": w_sec, "skill_density": w_den, "experience": w_exp},
            "fuzzy_threshold": fuzzy_threshold,
        },
        "recommendations": _recommendations(sect, merged, years_exp),
    }

def _recommendations(sect: Dict[str,bool], skills: List[str], years: float) -> List[str]:
    rec: List[str] = []
    if not sect["summary"]: rec.append("Add a 2–3 line professional summary with target role keywords.")
    if not sect["skills"]:  rec.append("Add a Skills section listing 8–12 focused, role-relevant skills.")
    if not sect["exp"]:     rec.append("Add Projects/Experience with metrics (impact, numbers).")
    if not sect["edu"]:     rec.append("Include Education with degree, institution, and year.")
    if not sect["links"]:   rec.append("Include links: GitHub / LinkedIn / Portfolio.")
    if years < 1 and "intern" not in " ".join(skills):
        rec.append("If early-career, include internships or course projects.")
    if len(skills) < 6:
        rec.append("Increase relevant technical skills density (aim 6–12 solid skills).")
    return rec[:6]

def suggest_missing_skills(
    resume_text: str,
    resume_skills: List[str],
    target_role: Optional[str],
    jobs: List[str],
    *,
    fuzzy_threshold: int = 90,
    max_out: int = 20,
) -> Dict:
    """
    Suggest missing skills from role hints and/or provided job descriptions.

    Returns:
        {
          "missing_skills": [...],
          "have_skills": [...],
          "reference_role": target_role,
          "derived_from_jobs": [...],
        }
    """
    text = _clean(resume_text)
    have = set(_normalize_skills((resume_skills or []) + _extract_skills(text, threshold=fuzzy_threshold)))

    # Role-hint list (ordered → this influences final priority)
    role_list: List[str] = []
    if target_role:
        role_key = target_role.lower().strip()
        for k, lst in ROLE_HINTS.items():
            if k in role_key:
                role_list = [s.lower() for s in lst]
                break

    # Skills mentioned in provided job descriptions that are also in taxonomy
    job_skills = set()
    if jobs:
        jd_blob = " \n ".join(jobs).lower()
        for s in TAXONOMY:
            if s.lower() in jd_blob:
                job_skills.add(s.lower())

    # Priority order: role hints first, then job-derived, while keeping uniqueness
    needed_ordered: List[str] = []
    seen = set()
    for src_list in (role_list, sorted(job_skills)):
        for s in src_list:
            if s not in seen:
                needed_ordered.append(s)
                seen.add(s)

    missing = [s for s in needed_ordered if s not in have]
    return {
        "missing_skills": missing[:max_out],
        "have_skills": sorted(have)[:50],
        "reference_role": target_role,
        "derived_from_jobs": sorted(job_skills)[:50],
        "fuzzy_threshold": fuzzy_threshold,
    }
