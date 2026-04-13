# backend/app/llm_api/routes/enrich_llm.py
from __future__ import annotations

import re
from typing import List, Optional, Dict
from urllib.parse import urlparse

from fastapi import APIRouter, Body, HTTPException, Query
from pydantic import BaseModel

# httpx is optional; if missing we still return heuristic results
try:
    import httpx  # type: ignore
except Exception:  # pragma: no cover
    httpx = None  # type: ignore

router = APIRouter()

# ───────────────────────── Models ───────────────────────── #
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

# ─────────────────────── Heuristics ─────────────────────── #
_RX_HOURS = re.compile(r"\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b", re.I)
_RX_WEEKS = re.compile(r"\b(\d+(?:\.\d+)?)\s*(?:weeks?|wks?)\b", re.I)
_RX_DAYS  = re.compile(r"\b(\d+(?:\.\d+)?)\s*(?:days?)\b", re.I)

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
    blob = " ".join([t for t in texts if t]).lower()
    for rx, unit in ((_RX_HOURS, "hour"), (_RX_WEEKS, "week"), (_RX_DAYS, "day")):
        m = rx.search(blob)
        if m:
            val = m.group(1)
            return f"{val} {unit}{'' if val in {'1','1.0'} else 's'}"
    return None

def _provider(source: Optional[str], link: Optional[str]) -> str:
    if source:
        return source.lower()
    if link:
        try:
            return urlparse(link).netloc.lower()
        except Exception:
            pass
    return ""

# ───── Optional lightweight live probe (no JS, no bs4) ───── #
async def _probe_live(link: str) -> Dict[str, Optional[str]]:
    if not httpx or not link or not link.startswith(("http://", "https://")):
        return {"duration": None, "cost": None}
    try:
        async with httpx.AsyncClient(
            timeout=8.0, headers={"User-Agent": "job-gap-fsd/1.0"}
        ) as client:
            r = await client.get(link, follow_redirects=True)
            html = r.text[:200_000]
    except Exception:
        return {"duration": None, "cost": None}

    dur = None
    cost = None

    # very rough/common patterns
    m = (
        re.search(r"(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)", html, re.I)
        or re.search(r"(\d+(?:\.\d+)?)\s*(?:weeks?|wks?)", html, re.I)
        or re.search(r"(\d+(?:\.\d+)?)\s*(?:days?)", html, re.I)
    )
    if m:
        val = m.group(1)
        unit_raw = m.group(0).lower()
        unit = "hour" if "hour" in unit_raw or "hr" in unit_raw else ("week" if "week" in unit_raw else "day")
        dur = f"{val} {unit}{'' if val in {'1','1.0'} else 's'}"

    if re.search(r"free(?! trial)", html, re.I):
        cost = "Free"
    elif re.search(r"paid|price|₹|\$|€", html, re.I):
        cost = "Paid"

    return {"duration": dur, "cost": cost}

# ───────────────────────── Endpoint ───────────────────────── #
@router.post("/api/v1/llm/ml/enrich-courses", response_model=EnrichResponse)
async def enrich_courses(
    payload: EnrichRequest,
    live_fetch: bool = Query(True, description="Try lightweight page fetch to refine duration/cost"),
) -> EnrichResponse:
    """
    Best-effort enrichment:
      1) keep provided duration/cost if present
      2) otherwise fill with provider heuristics
      3) optionally probe the page (httpx) to extract hints
    """
    out: List[CourseOut] = []

    for c in payload.courses:
        provider = _provider(c.source, c.link)

        duration = c.duration or _infer_duration_from([c.title, c.why or ""])
        cost     = c.cost     or _infer_cost(provider, c.link or "")

        if live_fetch and (duration is None or cost is None) and c.link:
            probe = await _probe_live(c.link)
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
