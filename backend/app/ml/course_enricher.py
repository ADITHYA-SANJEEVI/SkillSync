# backend/app/ml/course_enricher.py
from __future__ import annotations

import re
import asyncio
from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any, List
from urllib.parse import urlparse

# httpx preferred (async); degrade gracefully if missing
try:
    import httpx  # type: ignore
except Exception:  # pragma: no cover
    httpx = None  # type: ignore


@dataclass
class Course:
    title: str
    source: Optional[str] = None
    link: Optional[str] = None
    why: Optional[str] = None
    duration: Optional[str] = None
    cost: Optional[str] = None

    @staticmethod
    def from_any(x: Any) -> "Course":
        if isinstance(x, dict):
            return Course(
                title=str(x.get("title") or x.get("name") or "Untitled"),
                source=(x.get("source") or x.get("platform") or x.get("provider")),
                link=(x.get("link") or x.get("url") or x.get("href")),
                why=(x.get("why") or x.get("reason") or x.get("description")),
                duration=(x.get("duration") or x.get("hours") or x.get("time") or x.get("length")),
                cost=(x.get("cost") or x.get("price") or x.get("fee")),
            )
        return Course(title=str(x))

    def key(self) -> str:
        return f"{(self.link or '').strip()}::{self.title.strip()}"


# ───────────────────────────── Heuristics (cheap & fast) ─────────────────────────────

def _infer_cost(source: str | None, link: str | None) -> Optional[str]:
    blob = f"{source or ''} {link or ''}".lower()
    if "youtube" in blob or "kaggle" in blob or "mode.com" in blob:
        return "Free"
    if "coursera" in blob or "edx" in blob:
        return "Free to audit / Paid certificate"
    if "udemy" in blob:
        return "Paid (often discounted)"
    if "linkedin" in blob:
        return "Paid (subscription)"
    return None


_DURATION_PATTERNS = [
    re.compile(r"\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b", re.I),
    re.compile(r"\b(\d+(?:\.\d+)?)\s*(weeks?|wks?)\b", re.I),
    re.compile(r"\b(\d+(?:\.\d+)?)\s*(days?)\b", re.I),
]


def _infer_duration_from_text(*texts: str | None) -> Optional[str]:
    blob = " ".join(t or "" for t in texts).lower()
    for rx in _DURATION_PATTERNS:
        m = rx.search(blob)
        if m:
            val, unit = m.group(1), m.group(2).lower()
            unit = {"hrs": "hour", "hr": "hour", "h": "hour", "wks": "week"}.get(unit, unit.rstrip("s"))
            # pluralize if needed
            try:
                plural = "" if float(val) == 1 else "s"
            except Exception:
                plural = "s"
            return f"{val} {unit}{plural}"
    return None


# ───────────────────────────── Live scrapers (best effort) ─────────────────────────────

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

async def _fetch_text(url: str, timeout: float = 6.0) -> Optional[str]:
    if not httpx:
        return None
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=timeout, headers={"User-Agent": _UA}) as cli:
            r = await cli.get(url)
            if r.status_code < 400:
                # Some platforms render via JS; we still try regex over HTML/JSON blobs.
                return r.text
    except Exception:
        return None
    return None


def _domain(url: str | None) -> str:
    if not url:
        return ""
    try:
        return urlparse(url).netloc.lower()
    except Exception:
        return ""


async def _scrape_udemy(html: str | None) -> Optional[str]:
    """Extract total video hours from the raw HTML/JSON if present."""
    if not html:
        return None
    # 1) Modern JSON blob: "content_length_video":"12 total hours"
    m = re.search(r'"content_length_video"\s*:\s*"([^"]+)"', html)
    if m:
        txt = m.group(1)
        d = _infer_duration_from_text(txt)
        if d:
            return d
        # fallback: clean "12 total hours"
        mm = re.search(r"(\d+(?:\.\d+)?)\s*(?:total\s*)?hours?", txt, re.I)
        if mm:
            return f"{mm.group(1)} hours"
    # 2) Older: data-purpose="video-content-length">12.5 total hours
    m = re.search(r'data-purpose="video-content-length"[^>]*>\s*([^<]+)<', html)
    if m:
        d = _infer_duration_from_text(m.group(1))
        if d:
            return d
    return None


async def _scrape_coursera(html: str | None) -> Optional[str]:
    if not html:
        return None
    # Look for "X hours to complete" or "X weeks"
    m = re.search(r"(\d+(?:\.\d+)?)\s*(hours?|weeks?)\s+to\s+complete", html, re.I)
    if m:
        return _infer_duration_from_text(m.group(0))
    m = re.search(r"(\d+(?:\.\d+)?)\s*(hours?|weeks?)\b", html, re.I)
    if m:
        return _infer_duration_from_text(m.group(0))
    # Sometimes “X hours/week” appears:
    m = re.search(r"(\d+(?:\.\d+)?)\s*hours?\s*/\s*week", html, re.I)
    if m:
        return f"{m.group(1)} hours/week"
    return None


async def _scrape_edx(html: str | None) -> Optional[str]:
    if not html:
        return None
    # edX often shows “X weeks” and “Y–Z hours per week”
    m = re.search(r"(\d+(?:\.\d+)?)\s*(weeks?)", html, re.I)
    if m:
        return _infer_duration_from_text(m.group(0))
    m = re.search(r"(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*hours?\s*per\s*week", html, re.I)
    if m:
        return f"{m.group(1)}–{m.group(2)} hours/week"
    return None


async def _scrape_generic(html: str | None) -> Optional[str]:
    if not html:
        return None
    return _infer_duration_from_text(html)


async def enrich_one(c: Course, live_fetch: bool = True) -> Course:
    # Respect existing values, fill only missing.
    cost = c.cost or _infer_cost(c.source, c.link)

    duration = c.duration or _infer_duration_from_text(c.title, c.why or "")
    if (not duration) and live_fetch and c.link and httpx:
        dom = _domain(c.link)
        html = await _fetch_text(c.link)
        if "udemy" in dom:
            duration = await _scrape_udemy(html)
            cost = cost or "Paid (often discounted)"
        elif "coursera.org" in dom:
            duration = await _scrape_coursera(html)
            cost = cost or "Free to audit / Paid certificate"
        elif "edx.org" in dom:
            duration = await _scrape_edx(html)
            cost = cost or "Free to audit / Paid certificate"
        elif "kaggle.com" in dom or "youtube.com" in dom or "youtu.be" in dom:
            # Usually free; duration may be in title/desc only.
            duration = duration or await _scrape_generic(html)
            cost = cost or "Free"
        else:
            duration = await _scrape_generic(html)

    return Course(
        title=c.title,
        source=c.source,
        link=c.link,
        why=c.why,
        duration=duration,
        cost=cost,
    )


async def enrich_courses(payload: List[Dict[str, Any]], live_fetch: bool = True) -> List[Dict[str, Any]]:
    items = [Course.from_any(x) for x in (payload or [])]
    # Deduplicate by (link,title)
    seen: set[str] = set()
    uniq: List[Course] = []
    for it in items:
        k = it.key()
        if k not in seen:
            seen.add(k)
            uniq.append(it)

    results = await asyncio.gather(*(enrich_one(it, live_fetch=live_fetch) for it in uniq))
    return [asdict(r) for r in results]
