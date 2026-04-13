# backend/app/llm_api/routes/ml_enrich.py
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel

try:
    import httpx  # optional but recommended
except Exception:  # pragma: no cover
    httpx = None  # type: ignore

router = APIRouter()

# ---------- Models ----------
class CourseIn(BaseModel):
    title: str
    source: Optional[str] = None
    duration: Optional[str] = None
    cost: Optional[str] = None
    link: Optional[str] = None
    why: Optional[str] = None

class EnrichRequest(BaseModel):
    courses: List[CourseIn]

class CourseOut(CourseIn):
    duration: Optional[str] = None
    cost: Optional[str] = None

class EnrichResponse(BaseModel):
    courses: List[CourseOut]

# ---------- Heuristics ----------
_H_HOURS = re.compile(r"\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b", re.I)
_H_WEEKS = re.compile(r"\b(\d+(?:\.\d+)?)\s*(?:weeks?|wks?)\b", re.I)
_H_DAYS  = re.compile(r"\b(\d+(?:\.\d+)?)\s*(?:days?)\b", re.I)

def _infer_cost(source: str, link: str) -> Optional[str]:
    s = f"{source or ''} {link or ''}".lower()
    if "youtube" in s or "kaggle" in s or "mode.com" in s:
        return "Free"
    if "coursera" in s or "edx" in s:
        return "Free to audit / Paid certificate"
    if "udemy" in s:
        return "Paid (often discounted)"
    if "linkedin" in s:
        return "Paid (subscription)"
    return None

def _infer_duration_from(texts: List[str]) -> Optional[str]:
    blob = " ".join(filter(None, texts)).lower()
    for rx, unit in ((_H_HOURS, "hour"), (_H_WEEKS, "week"), (_H_DAYS, "day")):
        m = rx.search(blob)
        if m:
            val = m.group(1)
            plural = "" if val in {"1", "1.0"} else "s"
            return f"{val} {unit}{plural}"
    return None

def _provider_from(source: Optional[str], link: Optional[str]) -> str:
    if source:
        return source.lower()
    if link:
        try:
            return urlparse(link).netloc.lower()
        except Exception:
            return ""
    return ""

# ---------- Light “live” scraping (best effort) ----------
async def _probe_live_duration_cost(link: str) -> Dict[str, Optional[str]]:
    """
    Fetches the page and tries to extract duration/cost with simple regexes.
    This is intentionally lightweight (no JS, no bs4).
    """
    if not httpx or not link or not link.startswith(("http://", "https://")):
        return {"duration": None, "cost": None}

    try:
        async with httpx.AsyncClient(timeout=8.0, headers={"User-Agent": "job-gap-fsd/1.0"}) as client:
            r = await client.get(link, follow_redirects=True)
            html = r.text[:200_000]  # cap scanning
    except Exception:
        return {"duration": None, "cost": None}

    # very rough patterns frequently seen on platforms
    dur = None
    cost = None

    # Duration
    cand = (
        re.search(r"(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)", html, re.I)
        or re.search(r"(\d+(?:\.\d+)?)\s*(?:weeks?|wks?)", html, re.I)
        or re.search(r"(\d+(?:\.\d+)?)\s*(?:days?)", html, re.I)
    )
    if cand:
        val = cand.group(1)
        unit = re.sub(r".*?(\w+)$", r"\1", cand.group(0)).lower()
        unit = "hour" if "hour" in unit or "hr" in unit else ("week" if "week" in unit else "day")
        dur = f"{val} {unit}{'' if val in {'1','1.0'} else 's'}"

    # Cost
    if re.search(r"free(?! trial)", html, re.I):
        cost = "Free"
    elif re.search(r"paid|price|₹|\$|€", html, re.I):
        cost = "Paid"

    return {"duration": dur, "cost": cost}

# ---------- Endpoint ----------
@router.post("/api/v1/llm/ml/enrich-courses", response_model=EnrichResponse)
async def enrich_courses(
    payload: EnrichRequest = Body(...),
    live_fetch: bool = Query(True, description="Try lightweight page fetch to refine duration/cost"),
) -> EnrichResponse:
    """
    Adds best-effort `duration` and `cost` to each course using:
      1) Provided values (if already present)
      2) Provider heuristics (Coursera/edX/Udemy/YouTube/Kaggle/etc.)
      3) Optional lightweight page probe with httpx (if available)
    """
    out: List[CourseOut] = []
    for c in payload.courses:
        provider = _provider_from(c.source, c.link)

        duration = c.duration or _infer_duration_from([c.title, c.why or ""])
        cost     = c.cost     or _infer_cost(provider, c.link or "")

        # live probe if still missing
        if live_fetch and (duration is None or cost is None) and c.link:
            probe = await _probe_live_duration_cost(c.link)
            duration = duration or probe.get("duration")
            cost     = cost or probe.get("cost")

        out.append(
            CourseOut(
                title=c.title,
                source=c.source,
                link=c.link,
                why=c.why,
                duration=duration,
                cost=cost,
            )
        )

    return EnrichResponse(courses=out)
