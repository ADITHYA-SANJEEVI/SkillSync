# app/ml/gaps.py
from __future__ import annotations

"""
Gap computation utilities for Job-Gap-FSD.

This module preserves the original compute_gaps() function EXACTLY as-is
for backwards compatibility, and adds a richer enhanced pipeline with:
- normalization & aliasing
- partial/fuzzy matching (pure stdlib; no hard deps)
- coverage & score
- optional LLM (Chutes) explanations/suggestions driven by .env

Env (expected in backend/.env):
    CHUTES_API_KEY=...
    CHUTES_BASE_URL=https://llm.chutes.ai
    CHUTES_COMPLETIONS_PATH=/v1/chat/completions
    CHUTES_MODEL=deepseek-ai/DeepSeek-V3-0324
    CHUTES_TIMEOUT_SECONDS=60
"""

from typing import List, Dict, Tuple, Optional, Any
from dataclasses import dataclass, asdict
import os, json, math, re, time

# --- Optional HTTP (requests -> urllib fallback) -----------------------------
try:
    import requests  # type: ignore
    _HAS_REQUESTS = True
except Exception:
    _HAS_REQUESTS = False
    import urllib.request
    import urllib.error


# =============================================================================
# 0) ORIGINAL FUNCTION (UNTOUCHED)
# =============================================================================
def compute_gaps(candidate_skills: List[str], job_skills: List[str]) -> Dict[str, List[str]]:
    cand = set(s.strip().lower() for s in candidate_skills if s)
    job  = set(s.strip().lower() for s in job_skills if s)
    missing = sorted(list(job - cand))
    extras  = sorted(list(cand - job))
    partial: List[str] = []
    return {"missing": missing, "partial": partial, "extras": extras}


# =============================================================================
# 1) NORMALIZATION & ALIASES
# =============================================================================

_ALIASES: Dict[str, str] = {
    # Common skill standardizations (extend as needed)
    "node": "node.js",
    "nodejs": "node.js",
    "js": "javascript",
    "ts": "typescript",
    "py": "python",
    "reactjs": "react",
    "nextjs": "next.js",
    "mongo": "mongodb",
    "postgres": "postgresql",
    "oauth2": "oauth",
    "ci cd": "ci/cd",
    "cicd": "ci/cd",
    "ml": "machine learning",
    "nlp": "natural language processing",
    "opencv": "open cv",
    "xgbboost": "xgboost",  # your resume note
}

_PUNCT_RE = re.compile(r"[^\w\s\+\./#-]+", re.UNICODE)  # keep + . / # -


def _normalize_token(txt: str) -> str:
    """
    Normalize a single skill string:
    - trim, lower
    - collapse spaces
    - strip most punctuation (retain + . / # -)
    - apply alias map
    """
    if not txt:
        return ""
    t = txt.strip().lower()
    t = _PUNCT_RE.sub(" ", t)
    t = re.sub(r"\s+", " ", t).strip()
    # aliasing by whole-token
    alias = _ALIASES.get(t)
    if alias:
        return alias
    # quick alias for paths like "react js" -> "react"
    t = t.replace(" react js ", " react ").replace(" node js ", " node.js ")
    # collapse spaces around punctuation
    t = t.replace(" / ", "/").replace(" .", ".").replace(". ", ".")
    return t


def _normalize_list(items: List[str]) -> List[str]:
    return [s for s in (_normalize_token(x) for x in items or []) if s]


def _tokenize(t: str) -> List[str]:
    return [w for w in re.split(r"[\s/+\-\.#]+", t) if w]


# =============================================================================
# 2) FUZZY / PARTIAL SIMILARITY (pure stdlib)
# =============================================================================

def _jaccard_tokens(a: str, b: str) -> float:
    at, bt = set(_tokenize(a)), set(_tokenize(b))
    if not at or not bt:
        return 0.0
    inter = len(at & bt)
    union = len(at | bt)
    return inter / union if union else 0.0


def _prefix_bonus(a: str, b: str) -> float:
    # tiny nudge if one startswith the other token-wise
    at = " ".join(_tokenize(a))
    bt = " ".join(_tokenize(b))
    if at and bt:
        if at.startswith(bt) or bt.startswith(at):
            return 0.1
    return 0.0


def similarity(a: str, b: str) -> float:
    """Return 0..1 similarity. Lightweight but robust for skills."""
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    jac = _jaccard_tokens(a, b)
    sim = min(1.0, jac + _prefix_bonus(a, b))
    return round(sim, 4)


# =============================================================================
# 3) DATA MODEL
# =============================================================================

@dataclass
class MatchDetail:
    job_skill: str
    candidate_skill: Optional[str]
    kind: str  # "exact" | "partial" | "missing" | "extra"
    score: float  # similarity 0..1 for matches; 0 for missing/extra
    note: Optional[str] = None


@dataclass
class GapResult:
    missing: List[str]
    partial: List[str]
    extras: List[str]
    exact_matches: List[str]
    mapping: List[MatchDetail]
    coverage: float          # 0..1 how much of job skills covered
    score: int               # 0..100 composite (exact + partial credit)
    rationale: str           # human-readable brief


# =============================================================================
# 4) ENHANCED GAP COMPUTATION
# =============================================================================

def compute_gaps_enhanced(
    candidate_skills: List[str],
    job_skills: List[str],
    partial_threshold: float = 0.65,
    partial_credit: float = 0.5,
) -> GapResult:
    """
    Enhanced gap analysis:
    - normalization
    - exact & partial matching (best candidate for each job skill)
    - extras (candidate-only)
    - coverage & score

    Scoring:
        exact = 1.0, partial = partial_credit (default 0.5), missing = 0
        score = round(100 * (sum credits) / len(job_skills or [1]))
    """
    cand_norm = _normalize_list(candidate_skills)
    job_norm  = _normalize_list(job_skills)

    cand_set = set(cand_norm)
    job_set  = set(job_norm)

    # 1) Exact matches by intersection
    exact = sorted(list(job_set & cand_set))

    # 2) For each job skill not exactly matched, find best partial in candidate
    remaining_job = sorted(list(job_set - set(exact)))
    mapping: List[MatchDetail] = []
    partial_hits: List[str] = []
    missing: List[str] = []

    for js in remaining_job:
        best_c: Optional[str] = None
        best_s = 0.0
        for cs in cand_set:
            s = similarity(js, cs)
            if s > best_s:
                best_s, best_c = s, cs
        if best_c is not None and best_s >= partial_threshold:
            partial_hits.append(js)
            mapping.append(MatchDetail(job_skill=js, candidate_skill=best_c, kind="partial", score=best_s))
        else:
            missing.append(js)
            mapping.append(MatchDetail(job_skill=js, candidate_skill=None, kind="missing", score=0.0))

    # 3) Extras = candidate skills not used in exact matches (we still show them)
    extras = sorted(list(cand_set - job_set))

    # Add exact mappings explicitly (use score 1.0)
    for js in exact:
        mapping.append(MatchDetail(job_skill=js, candidate_skill=js, kind="exact", score=1.0))

    # 4) Coverage & score
    total = max(1, len(job_set))
    credits = len(exact) * 1.0 + len(partial_hits) * max(0.0, min(1.0, partial_credit))
    coverage = credits / total
    score = int(round(coverage * 100))

    # Friendly rationale
    rationale = (
        f"{len(exact)} exact, {len(partial_hits)} partial, {len(missing)} missing "
        f"out of {len(job_set)} required skills. Coverage={coverage:.2f} → Score={score}/100."
    )

    # Sort mapping for stable output: exact > partial > missing, then alpha
    kind_rank = {"exact": 0, "partial": 1, "missing": 2, "extra": 3}
    mapping_sorted = sorted(mapping, key=lambda m: (kind_rank.get(m.kind, 9), m.job_skill, -(m.score or 0)))

    return GapResult(
        missing=sorted(missing),
        partial=sorted(partial_hits),
        extras=extras,
        exact_matches=sorted(exact),
        mapping=mapping_sorted,
        coverage=round(coverage, 4),
        score=score,
        rationale=rationale,
    )


# =============================================================================
# 5) CHUTES LLM INTEGRATION (Optional)
# =============================================================================

class ChutesClient:
    """
    Tiny client for Chutes chat completions (OpenAI-compatible schema).

    Safe to import without requests; falls back to urllib.
    If env not present or call fails, methods return a dict with 'error'.
    """

    def __init__(self):
        self.api_key = os.getenv("CHUTES_API_KEY", "").strip()
        self.base_url = os.getenv("CHUTES_BASE_URL", "https://llm.chutes.ai").rstrip("/")
        self.path = os.getenv("CHUTES_COMPLETIONS_PATH", "/v1/chat/completions")
        self.model = os.getenv("CHUTES_MODEL", "deepseek-ai/DeepSeek-V3-0324")
        self.timeout = int(os.getenv("CHUTES_TIMEOUT_SECONDS", "60") or "60")

    def _endpoint(self) -> str:
        return f"{self.base_url}{self.path}"

    def available(self) -> bool:
        return bool(self.api_key)

    def chat(self, system: str, user: str, temperature: float = 0.2, max_tokens: int = 600) -> Dict[str, Any]:
        if not self.available():
            return {"error": "CHUTES_API_KEY missing; skipping LLM call."}

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            if _HAS_REQUESTS:
                resp = requests.post(self._endpoint(), headers=headers, json=payload, timeout=self.timeout)  # type: ignore
                if resp.status_code >= 400:
                    return {"error": f"Chutes HTTP {resp.status_code}: {resp.text[:300]}"}
                data = resp.json()
            else:
                req = urllib.request.Request(self._endpoint(), data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")  # type: ignore
                with urllib.request.urlopen(req, timeout=self.timeout) as r:  # type: ignore
                    data = json.loads(r.read().decode("utf-8"))
            # OpenAI-compatible parsing
            text = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )
            return {"ok": True, "text": text, "raw": data}
        except Exception as e:
            return {"error": f"Chutes call failed: {e.__class__.__name__}: {e}"}


def suggest_learning_plan_with_llm(
    gaps: GapResult,
    candidate_title: Optional[str] = None,
    job_title: Optional[str] = None,
    experience_years: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Uses Chutes (if configured) to generate:
    - succinct explanation of gaps
    - prioritized learning plan (2-week and 4-week tracks)
    - practice tasks & project suggestions
    Returns dict with 'explanation', 'plan', and possibly 'error'.
    """
    client = ChutesClient()
    if not client.available():
        return {"error": "CHUTES_API_KEY missing; set it in .env to enable LLM guidance."}

    sys = (
        "You are a concise career coach for software candidates. "
        "Output short, actionable bullet points. Avoid fluff."
    )
    user_blob = {
        "context": {
            "candidate_title": candidate_title or "",
            "job_title": job_title or "",
            "experience_years": experience_years or "",
        },
        "gaps_summary": {
            "score": gaps.score,
            "coverage": gaps.coverage,
            "rationale": gaps.rationale,
        },
        "missing": gaps.missing,
        "partial": gaps.partial,
        "exact_matches": gaps.exact_matches,
        "extras": gaps.extras,
        "examples_mapping": [asdict(m) for m in gaps.mapping[:15]],  # truncate long lists
        "request": [
            "1) One-paragraph explanation of what’s missing (plain English).",
            "2) A prioritized learning plan with 2-week and 4-week tracks.",
            "3) Practice tasks and a mini-project outline to demonstrate skills.",
            "4) If relevant, suggest quick wins to convert partial to exact matches.",
        ],
    }
    resp = client.chat(system=sys, user=json.dumps(user_blob, ensure_ascii=False, indent=2))
    if "error" in resp:
        return {"error": resp["error"]}
    text = (resp.get("text") or "").strip()
    return {
        "ok": True,
        "explanation": text,
    }


# =============================================================================
# 6) PUBLIC API HELPERS
# =============================================================================

def analyze_and_optionally_explain(
    candidate_skills: List[str],
    job_skills: List[str],
    partial_threshold: float = 0.65,
    partial_credit: float = 0.5,
    want_llm_explanation: bool = False,
    candidate_title: Optional[str] = None,
    job_title: Optional[str] = None,
    experience_years: Optional[int] = None,
) -> Dict[str, Any]:
    """
    One-stop helper suitable for your FastAPI endpoint code:

    Returns a JSON-serializable dict:
    {
      "result": GapResult-like fields,
      "llm": { "explanation": "..."}  # only if want_llm_explanation and CHUTES env present
    }
    """
    gaps = compute_gaps_enhanced(
        candidate_skills=candidate_skills,
        job_skills=job_skills,
        partial_threshold=partial_threshold,
        partial_credit=partial_credit,
    )

    payload: Dict[str, Any] = {
        "result": {
            "missing": gaps.missing,
            "partial": gaps.partial,
            "extras": gaps.extras,
            "exact_matches": gaps.exact_matches,
            "mapping": [asdict(m) for m in gaps.mapping],
            "coverage": gaps.coverage,
            "score": gaps.score,
            "rationale": gaps.rationale,
        }
    }

    if want_llm_explanation:
        llm = suggest_learning_plan_with_llm(
            gaps=gaps,
            candidate_title=candidate_title,
            job_title=job_title,
            experience_years=experience_years,
        )
        payload["llm"] = llm

    return payload


# =============================================================================
# 7) __main__ (manual quick test)
# =============================================================================

if __name__ == "__main__":
    # Quick sanity check (runs without network/LLM)
    cand = [
        "Python", "FastAPI", "React", "Next.js", "PostgreSQL",
        "OAuth", "Docker", "CI/CD", "XGBBoost", "OpenCV"
    ]
    job  = [
        "Python", "FastAPI", "ReactJS", "TypeScript", "Postgres",
        "OAuth2", "Docker", "Kubernetes", "GitHub Actions", "XGBoost"
    ]

    print("=== ORIGINAL compute_gaps ===")
    print(json.dumps(compute_gaps(cand, job), indent=2))

    print("\n=== ENHANCED compute_gaps_enhanced ===")
    enhanced = compute_gaps_enhanced(cand, job)
    print(json.dumps({
        "missing": enhanced.missing,
        "partial": enhanced.partial,
        "extras": enhanced.extras,
        "exact_matches": enhanced.exact_matches,
        "coverage": enhanced.coverage,
        "score": enhanced.score,
        "rationale": enhanced.rationale,
        "top_mapping": [asdict(m) for m in enhanced.mapping[:5]],
    }, indent=2))

    # Optional: LLM explanation if env set
    if os.getenv("CHUTES_API_KEY"):
        print("\n=== LLM EXPLANATION (Chutes) ===")
        out = suggest_learning_plan_with_llm(enhanced, candidate_title="Backend Engineer", job_title="ML Engineer", experience_years=2)
        print(json.dumps(out, indent=2))
    else:
        print("\n(LLM disabled: set CHUTES_API_KEY in .env to enable coaching output.)")
