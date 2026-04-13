# app/ml/recommend.py
from __future__ import annotations
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
import os, re, json, time, math, hashlib

"""
Recommendation utilities for Job-Gap-FSD.

- Preserves ORIGINAL recommend(needed_skills, catalog, limit=8) behavior.
- Adds recommend_from_prompt(prompt, catalog, ...) to accept a single
  natural-language string and return a richly structured, partitioned plan.

Env (in backend/.env):
    CHUTES_API_KEY=...
    CHUTES_BASE_URL=https://llm.chutes.ai
    CHUTES_COMPLETIONS_PATH=/v1/chat/completions
    CHUTES_MODEL=deepseek-ai/DeepSeek-V3-0324
    CHUTES_TIMEOUT_SECONDS=60
"""

# -----------------------------------------------------------------------------
# OPTIONAL HTTP (requests -> urllib fallback)
# -----------------------------------------------------------------------------
try:
    import requests  # type: ignore
    _HAS_REQUESTS = True
except Exception:
    _HAS_REQUESTS = False
    import urllib.request
    import urllib.error

# -----------------------------------------------------------------------------
# ORIGINAL FUNCTION (UNTOUCHED)
# -----------------------------------------------------------------------------
def recommend(needed_skills: List[str], catalog, limit: int = 8) -> List[Dict[str, Any]]:
    """
    Looks up courses per skill using catalog mappings.
    Supports either catalog.skill_to_courses or catalog.courses_by_skill.
    """
    if not needed_skills:
        return []

    results: List[Dict[str, Any]] = []
    seen = set()

    for skill in needed_skills:
        key = (skill or "").strip().lower()
        if not key:
            continue
        if hasattr(catalog, "skill_to_courses"):
            courses = getattr(catalog, "skill_to_courses", {}).get(key, [])
        elif hasattr(catalog, "courses_by_skill"):
            courses = getattr(catalog, "courses_by_skill", {}).get(key, [])
        else:
            courses = []

        for c in courses or []:
            cid = c.get("id") or c.get("_id") or c.get("url") or f"{key}:{c.get('title')}"
            if not cid or cid in seen:
                continue
            seen.add(cid)
            results.append({
                "id": cid,
                "title": c.get("title") or c.get("name") or "Untitled",
                "provider": c.get("provider") or c.get("source") or "Unknown",
                "url": c.get("url") or "",
                "matches": [key],
                "skills": c.get("skills") or [],
            })
            if len(results) >= limit:
                return results
    return results[:limit]

# -----------------------------------------------------------------------------
# LIGHT NORMALIZATION & ALIASES (consistent with gaps.py style)
# -----------------------------------------------------------------------------
_ALIASES = {
    "node": "node.js", "nodejs": "node.js",
    "js": "javascript", "ts": "typescript",
    "py": "python", "reactjs": "react",
    "nextjs": "next.js", "postgres": "postgresql",
    "oauth2": "oauth", "ci cd": "ci/cd", "cicd": "ci/cd",
    "ml": "machine learning", "nlp": "natural language processing",
    "opencv": "open cv", "xgbboost": "xgboost",
}

_PUNCT_RE = re.compile(r"[^\w\s\+\./#-]+", re.UNICODE)

def _norm(txt: str) -> str:
    if not txt:
        return ""
    t = txt.strip().lower()
    t = _PUNCT_RE.sub(" ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return _ALIASES.get(t, t)

def _norm_list(xs: Optional[List[str]]) -> List[str]:
    return [s for s in (_norm(x) for x in xs or []) if s]

# -----------------------------------------------------------------------------
# CHUTES CLIENT (optional)
# -----------------------------------------------------------------------------
class ChutesClient:
    def __init__(self):
        self.api_key = (os.getenv("CHUTES_API_KEY") or "").strip()
        self.base_url = (os.getenv("CHUTES_BASE_URL") or "https://llm.chutes.ai").rstrip("/")
        self.path = os.getenv("CHUTES_COMPLETIONS_PATH") or "/v1/chat/completions"
        self.model = os.getenv("CHUTES_MODEL") or "deepseek-ai/DeepSeek-V3-0324"
        self.timeout = int(os.getenv("CHUTES_TIMEOUT_SECONDS") or "60")

    def available(self) -> bool:
        return bool(self.api_key)

    def _endpoint(self) -> str:
        return f"{self.base_url}{self.path}"

    def chat(self, system: str, user: str, temperature: float = 0.1, max_tokens: int = 700) -> Dict[str, Any]:
        if not self.available():
            return {"error": "CHUTES_API_KEY missing."}
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        try:
            if _HAS_REQUESTS:
                r = requests.post(self._endpoint(), json=payload, headers=headers, timeout=self.timeout)  # type: ignore
                if r.status_code >= 400:
                    return {"error": f"HTTP {r.status_code}: {r.text[:300]}"}
                data = r.json()
            else:
                req = urllib.request.Request(self._endpoint(), data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")  # type: ignore
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:  # type: ignore
                    data = json.loads(resp.read().decode("utf-8"))
            text = (data.get("choices", [{}])[0].get("message", {}) or {}).get("content", "")
            return {"ok": True, "text": text, "raw": data}
        except Exception as e:
            return {"error": f"Chutes call failed: {e.__class__.__name__}: {e}"}

# -----------------------------------------------------------------------------
# DATA SHAPES
# -----------------------------------------------------------------------------
@dataclass
class ParsedParams:
    target_skills: List[str]
    role: Optional[str] = None
    experience_level: Optional[str] = None  # beginner|intermediate|advanced
    time_per_week_hours: Optional[int] = None
    duration_weeks: Optional[int] = None
    prefers_free: Optional[bool] = None
    budget: Optional[float] = None
    learning_style: Optional[str] = None     # hands_on|video|reading|mixed
    certification_preference: Optional[str] = None  # none|nice_to_have|required
    language: Optional[str] = None
    region: Optional[str] = None
    prerequisites_known: Optional[List[str]] = None
    avoid: Optional[List[str]] = None

@dataclass
class CourseItem:
    id: str
    title: str
    provider: str
    url: str
    modality: str = "course"  # course|doc|video|repo|lab|micro-cert
    level: str = "intro"      # intro|intermediate|advanced
    hours: Optional[float] = None
    cost: str = "unknown"     # free|paid|unknown
    coverage: List[str] = None
    prerequisites: List[str] = None
    score: Dict[str, Any] = None
    why: List[str] = None
    provenance: Optional[str] = None
    notes: Optional[str] = None

# -----------------------------------------------------------------------------
# PROMPT PARSING (LLM first; heuristic fallback)
# -----------------------------------------------------------------------------
def _heuristic_parse(prompt: str) -> ParsedParams:
    p = prompt.lower()
    # skills ~ words around "for", commas, +, and spaces
    # crude extraction; LLM path supersedes when available
    skills = re.findall(r"for ([^,.;]+)", p)
    if skills:
        raw = re.split(r"[+,&/]| and |,|\s{2,}", skills[0])
        target_skills = _norm_list([x for x in (s.strip() for s in raw) if x])
    else:
        # fallback: take top 5 tokens that look like tech words
        target_skills = _norm_list(re.findall(r"[a-z][a-z0-9.+#/-]{2,}", p))[:5]

    hours = None
    m_hours = re.search(r"(\d+)\s*-\s*(\d+)\s*h", p) or re.search(r"(\d+)\s*h(?:ours?)?", p)
    if m_hours:
        if len(m_hours.groups()) == 2:
            lo, hi = int(m_hours.group(1)), int(m_hours.group(2))
            hours = max(lo, min(hi, 20))
        else:
            hours = int(m_hours.group(1))

    weeks = None
    m_weeks = re.search(r"(\d+)\s*-\s*(\d+)\s*w", p) or re.search(r"(\d+)\s*w(?:eeks?)?", p)
    if m_weeks:
        if len(m_weeks.groups()) == 2:
            lo, hi = int(m_weeks.group(1)), int(m_weeks.group(2))
            weeks = max(lo, min(hi, 16))
        else:
            weeks = int(m_weeks.group(1))

    level = None
    if "beginner" in p: level = "beginner"
    elif "advanced" in p: level = "advanced"
    elif "intermediate" in p: level = "intermediate"

    prefers_free = "free" in p and "free if possible" in p or "prefer free" in p

    return ParsedParams(
        target_skills=target_skills or [],
        experience_level=level,
        time_per_week_hours=hours,
        duration_weeks=weeks,
        prefers_free=prefers_free or None,
        learning_style=("hands_on" if "hands-on" in p or "project" in p else "mixed"),
    )

def _parse_with_llm(prompt: str) -> Tuple[ParsedParams, Dict[str, Any]]:
    client = ChutesClient()
    if not client.available():
        return _heuristic_parse(prompt), {"error": "LLM unavailable; used heuristic parser."}

    system = (
        "You extract structured course-planning parameters from a single sentence. "
        "Return STRICT JSON with keys: target_skills[], role, experience_level "
        "(beginner|intermediate|advanced), time_per_week_hours (int), duration_weeks (int), "
        "prefers_free (bool), budget (float|null), learning_style (hands_on|video|reading|mixed), "
        "certification_preference (none|nice_to_have|required), language, region, "
        "prerequisites_known[], avoid[]. If missing, set null or empty arrays."
    )
    user = f"INPUT: {prompt}\nRespond with JSON only."
    resp = client.chat(system=system, user=user, temperature=0.0, max_tokens=400)
    if "error" in resp:
        return _heuristic_parse(prompt), {"error": resp["error"]}
    try:
        parsed = json.loads(resp.get("text") or "{}")
        pp = ParsedParams(
            target_skills=_norm_list(parsed.get("target_skills") or []),
            role=parsed.get("role"),
            experience_level=parsed.get("experience_level"),
            time_per_week_hours=parsed.get("time_per_week_hours"),
            duration_weeks=parsed.get("duration_weeks"),
            prefers_free=parsed.get("prefers_free"),
            budget=parsed.get("budget"),
            learning_style=parsed.get("learning_style"),
            certification_preference=parsed.get("certification_preference"),
            language=parsed.get("language"),
            region=parsed.get("region"),
            prerequisites_known=_norm_list(parsed.get("prerequisites_known") or []),
            avoid=_norm_list(parsed.get("avoid") or []),
        )
        return pp, {"ok": True}
    except Exception as e:
        return _heuristic_parse(prompt), {"error": f"LLM JSON parse failed: {e.__class__.__name__}"}

# -----------------------------------------------------------------------------
# CATALOG RETRIEVAL & RANKING
# -----------------------------------------------------------------------------
def _hash_id(*parts: str) -> str:
    base = "||".join(p or "" for p in parts)
    return hashlib.sha1(base.encode("utf-8")).hexdigest()[:16]

def _iter_courses_for_skills(skills: List[str], catalog) -> List[Dict[str, Any]]:
    seen = set()
    out: List[Dict[str, Any]] = []
    for skill in skills or []:
        key = _norm(skill)
        pool = []
        if hasattr(catalog, "skill_to_courses"):
            pool = getattr(catalog, "skill_to_courses", {}).get(key, [])
        elif hasattr(catalog, "courses_by_skill"):
            pool = getattr(catalog, "courses_by_skill", {}).get(key, [])
        for c in pool or []:
            cid = c.get("id") or c.get("_id") or c.get("url") or _hash_id(key, c.get("title",""))
            if cid in seen:
                continue
            seen.add(cid)
            out.append(c)
    return out

def _score_item(c: Dict[str, Any], params: ParsedParams, targets: List[str]) -> Tuple[float, Dict[str, Any], List[str]]:
    target_set = set(targets)
    cov = set(_norm_list(c.get("skills") or c.get("coverage") or []))
    exact = len(target_set & cov)
    partial = sum(1 for t in target_set if any(t in x or x in t for x in cov)) - exact
    skill_match = min(1.0, (exact + 0.5*max(0, partial)) / max(1, len(target_set)))

    # depth fit (very light heuristic)
    level_map = {"beginner":"intro", "intermediate":"intermediate", "advanced":"advanced"}
    desired = level_map.get((params.experience_level or "").lower())
    level = (c.get("level") or "intro").lower()
    depth_fit = 1.0 if (not desired or desired in level) else (0.6 if desired=="intermediate" and level=="intro" else 0.4)

    # time fit
    hours = c.get("hours")
    if params.time_per_week_hours and params.duration_weeks and isinstance(hours, (int,float)):
        budget = params.time_per_week_hours * params.duration_weeks
        time_fit = 1.0 if hours <= budget else max(0.2, budget/float(hours))
    else:
        time_fit = 0.8 if hours else 0.6

    # provider trust
    provider = (c.get("provider") or c.get("source") or "unknown").lower()
    trusted = {"coursera","edx","udacity","udemy","pluralsight","o'reilly","docs","github","microsoft","google","aws","linux foundation","kubernetes","datacamp"}
    provider_trust = 1.0 if provider in trusted or "docs" in provider else 0.7

    # freshness (use year tags if present)
    freshness = 0.8
    title = (c.get("title") or "").lower()
    m = re.search(r"(20\d{2})", title)
    if m:
        year = int(m.group(1))
        freshness = 1.0 if year >= 2023 else (0.9 if year >= 2021 else 0.7)

    # cost/access
    cost_str = (c.get("cost") or "").lower()
    is_free = "free" in cost_str or cost_str == "0"
    cost_access = 1.0 if (params.prefers_free and is_free) or (not params.prefers_free) else (0.7 if not cost_str else 0.5)

    # diversity bonus (caller will compute across set; here a neutral placeholder)
    diversity = 0.5

    # weighted sum
    w = {
        "skill_match": 0.45, "depth_fit": 0.15, "time_fit": 0.10,
        "provider_trust": 0.10, "freshness": 0.10,
        "cost_access": 0.05, "diversity": 0.05
    }
    total = (w["skill_match"]*skill_match + w["depth_fit"]*depth_fit + w["time_fit"]*time_fit +
             w["provider_trust"]*provider_trust + w["freshness"]*freshness +
             w["cost_access"]*cost_access + w["diversity"]*diversity)

    why = []
    if exact: why.append(f"covers {exact} target skills")
    if partial>0: why.append(f"partially covers {partial}")
    if hours: why.append(f"{hours}h fits budget" if time_fit>=0.9 else f"{hours}h (heavy)")
    why.append("trusted provider" if provider_trust>=0.95 else "general provider")
    if params.prefers_free: why.append("free option" if is_free else "paid (alt free provided)")

    subs = {
        "total": round(total*100),
        "skill_match": round(100*skill_match),
        "depth_fit": round(100*depth_fit),
        "time_fit": round(100*time_fit),
        "provider_trust": round(100*provider_trust),
        "freshness": round(100*freshness),
        "cost_access": round(100*cost_access),
        "diversity": round(100*diversity),
    }
    return total, subs, why

def _normalize_course(c: Dict[str, Any]) -> CourseItem:
    cid = c.get("id") or c.get("_id") or c.get("url") or _hash_id(c.get("title",""), c.get("provider",""))
    return CourseItem(
        id=str(cid),
        title=c.get("title") or c.get("name") or "Untitled",
        provider=c.get("provider") or c.get("source") or "Unknown",
        url=c.get("url") or "",
        modality=(c.get("modality") or "course").lower(),
        level=(c.get("level") or "intro").lower(),
        hours=c.get("hours"),
        cost=(str(c.get("cost")).lower() if c.get("cost") is not None else (("free" if "free" in (c.get("tags") or []) else "unknown"))),
        coverage=_norm_list(c.get("coverage") or c.get("skills") or []),
        prerequisites=_norm_list(c.get("prerequisites") or []),
        provenance=c.get("provenance"),
        notes=c.get("notes"),
        score={}, why=[],
    )

def _dedup_by_id(items: List[CourseItem]) -> List[CourseItem]:
    seen, out = set(), []
    for it in items:
        if it.id in seen: continue
        seen.add(it.id); out.append(it)
    return out

def _partition_buckets(items: List[CourseItem], params: ParsedParams) -> Dict[str, List[str]]:
    quick, foundations, projects, certs, stretch = [], [], [], [], []
    # Heuristics: quick wins are <=6h or docs/labs; projects identified by modality or title keywords
    for it in items:
        hrs = it.hours or 0
        title_l = it.title.lower()
        if it.modality in ("doc","lab","repo") or (hrs and hrs <= 6):
            quick.append(it.id)
        elif "project" in title_l or it.modality in ("repo","lab") and hrs >= 4:
            projects.append(it.id)
        elif "cert" in title_l or it.modality == "micro-cert":
            certs.append(it.id)
        elif it.level in ("intro","intermediate"):
            foundations.append(it.id)
        else:
            stretch.append(it.id)

    # Keep buckets tight (3–6)
    def trim(xs: List[str], n: int = 6) -> List[str]:
        return xs[:n]
    return {
        "quick_wins": trim(quick, 4),
        "foundations": trim(foundations, 6),
        "projects": trim(projects, 2),
        "certifications": trim(certs, 2),
        "stretch": trim(stretch, 4),
    }

def _build_schedule(items: Dict[str, CourseItem], buckets: Dict[str, List[str]], params: ParsedParams) -> Dict[str, Any]:
    # Pack by week to honor time budget if provided
    tpw = params.time_per_week_hours or 6
    # Compose an ordered list by priority: foundations -> quick -> projects -> stretch
    order = buckets["foundations"] + buckets["quick_wins"] + buckets["projects"] + buckets["stretch"]
    def pack(weeks: int):
        sched = []
        cur, curh = [], 0.0
        w = 1
        for cid in order:
            it = items.get(cid)
            h = float(it.hours or 4)
            if curh + h > tpw and cur:
                sched.append({"week": w, "items": cur, "checkpoint": f"Complete {len(cur)} item(s)"})
                w += 1; cur = []; curh = 0.0
                if w > weeks: break
            cur.append(cid); curh += h
        if cur and len(sched) < weeks:
            sched.append({"week": w, "items": cur, "checkpoint": f"Complete {len(cur)} item(s)"})
        return sched
    return {
        "two_weeks": pack(2),
        "four_weeks": pack(4),
    }

# -----------------------------------------------------------------------------
# PUBLIC ENTRYPOINT: from a single prompt string
# -----------------------------------------------------------------------------
def recommend_from_prompt(
    prompt: str,
    catalog,
    max_considered_per_skill: int = 40,
    max_return: int = 20,
    include_llm_notes: bool = True,
) -> Dict[str, Any]:
    start = time.time()
    parsed, parse_meta = _parse_with_llm(prompt)

    # If no skills parsed, fail early with graceful message
    targets = parsed.target_skills
    inferred_defaults = []
    if not targets:
        inferred_defaults.append({"field":"target_skills", "value": [], "reason":"not provided; cannot retrieve skill-targeted courses"})

    # reasonable defaults
    if parsed.time_per_week_hours is None:
        parsed.time_per_week_hours = 6
        inferred_defaults.append({"field": "time_per_week_hours", "value": 6, "reason": "default for working student"})
    if parsed.duration_weeks is None:
        parsed.duration_weeks = 4
        inferred_defaults.append({"field": "duration_weeks", "value": 4, "reason": "typical sprint horizon"})
    if parsed.learning_style is None:
        parsed.learning_style = "mixed"; inferred_defaults.append({"field":"learning_style","value":"mixed","reason":"not specified"})
    if parsed.experience_level is None:
        parsed.experience_level = "beginner"; inferred_defaults.append({"field":"experience_level","value":"beginner","reason":"not specified"})

    # Retrieve from catalog
    pool = _iter_courses_for_skills(targets, catalog) if targets else []
    # optionally truncate per skill (already deduped in iterator)
    # Normalize & score
    normed: List[CourseItem] = [_normalize_course(c) for c in pool]
    # Score + sort
    scored: List[Tuple[float, CourseItem]] = []
    for it in normed:
        total, subs, why = _score_item(asdict(it), parsed, targets)
        it.score = subs
        it.why = why
        scored.append((total, it))
    # Sort by score desc
    scored.sort(key=lambda x: x[0], reverse=True)
    ranked_items = [it for _, it in scored][:max_return]
    ranked_items = _dedup_by_id(ranked_items)

    # Build buckets & schedule
    buckets = _partition_buckets(ranked_items, parsed)
    items_by_id = {it.id: it for it in ranked_items}
    schedule = _build_schedule(items_by_id, buckets, parsed)

    # Build alternatives per skill (simple: next 2 items that cover the skill)
    alternatives: Dict[str, List[str]] = {}
    for skill in targets:
        sid = _norm(skill)
        alts = []
        for _, it in scored:
            if it.id in items_by_id:  # already selected item
                continue
            cov = set(it.coverage or [])
            if sid in cov:
                alts.append(it.id)
            if len(alts) >= 2:
                break
        alternatives[sid] = alts

    # Optional LLM notes (summaries only, no new links)
    llm_notes = None
    if include_llm_notes and ChutesClient().available():
        client = ChutesClient()
        system = ("You are a concise learning coach. Summarize the selected items ONLY; "
                  "do not invent new links. Provide an executive_summary (<=120 words) and "
                  "coaching_tips (<=6 bullets).")
        user_payload = {
            "params": asdict(parsed),
            "selected_items": [asdict(it) for it in ranked_items[:10]],
            "buckets": buckets,
            "schedule_two_weeks": schedule["two_weeks"],
        }
        resp = client.chat(system=system, user=json.dumps(user_payload), temperature=0.2, max_tokens=350)
        if "ok" in resp:
            llm_text = (resp.get("text") or "").strip()
            llm_notes = {"executive_summary": llm_text[:1200]}  # keep simple; caller may post-process

    # Rationale & telemetry
    rationale = (
        "Deterministic ranking by skill coverage, level/time fit, provider trust, freshness, and cost/access. "
        "Buckets emphasize quick momentum, then foundational depth, then projects."
    )
    input_hash = hashlib.sha1(prompt.encode("utf-8")).hexdigest()[:12]
    telemetry = {
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "input_hash": input_hash,
        "scoring_version": "recos-v3",
        "cache_hit": False,
        "retrieval_ms": int((time.time() - start) * 1000),
        "parse_meta": parse_meta,
    }

    # Assemble final payload
    payload = {
        "request_echo": prompt,
        "parsed_params": asdict(parsed),
        "inferred_defaults": inferred_defaults,
        "clarifications_recommended": [
            "Is certification important (e.g., CKA/AWS)? yes/no",
            "Prefer hands-on labs or video-first courses?"
        ],
        "retrieval_summary": {
            "providers": getattr(catalog, "providers", ["catalog"]),
            "considered": len(pool),
            "returned": len(ranked_items)
        },
        "recommendations": buckets,
        "courses": [asdict(it) for it in ranked_items],
        "schedule": schedule,
        "alternatives": alternatives,
        "rationale": rationale,
        "telemetry": telemetry,
    }
    if llm_notes:
        payload["llm_notes"] = llm_notes
    return payload
