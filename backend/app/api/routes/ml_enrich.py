# backend/app/api/routes/ml_enrich.py
from __future__ import annotations

import json
import re
import time
from functools import lru_cache
from typing import List, Optional, Dict, Any
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, HttpUrl, Field

router = APIRouter(prefix="/api/v1/llm/ml", tags=["ml-enrich"])

# ──────────────────────────────────────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────────────────────────────────────

class InCourse(BaseModel):
    title: str = Field(..., description="Display title")
    link: Optional[HttpUrl] = Field(None, description="Absolute URL to the course page")
    source: Optional[str] = Field(None, description="Provider/platform hint (Coursera, edX, Udemy, YouTube, Kaggle)")
    why: Optional[str] = None

class OutCourse(BaseModel):
    title: str
    link: Optional[HttpUrl] = None
    source: Optional[str] = None
    duration: Optional[str] = None  # human string, e.g. "12 hours", "4 weeks"
    cost: Optional[str] = None      # human string, e.g. "Free", "₹3,499", "Free to audit / Paid certificate"

class EnrichRequest(BaseModel):
    courses: List[InCourse]

class EnrichResponse(BaseModel):
    courses: List[OutCourse]

# ──────────────────────────────────────────────────────────────────────────────
# HTTP client
# ──────────────────────────────────────────────────────────────────────────────

UA = "JobGapFSD-Enricher/1.0 (+https://localhost) python-httpx"

def _client() -> httpx.Client:
    return httpx.Client(
        headers={"User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8"},
        timeout=httpx.Timeout(10.0, read=15.0),
        follow_redirects=True,
        verify=True,
    )

# ──────────────────────────────────────────────────────────────────────────────
# Utilities: parsing
# ──────────────────────────────────────────────────────────────────────────────

ISO_DURATION = re.compile(r"P(?:(\d+)W)?(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?", re.I)

def _iso_to_human(iso: str) -> Optional[str]:
    """
    Convert ISO 8601 durations like 'PT12H30M', 'P4W', 'P1WT10H' → human text.
    """
    m = ISO_DURATION.fullmatch(iso.strip())
    if not m:
        return None
    weeks, days, hours, minutes = (int(x) if x else 0 for x in m.groups())
    if weeks:
        return f"{weeks} week{'s' if weeks != 1 else ''}"
    if days and not (hours or minutes):
        return f"{days} day{'s' if days != 1 else ''}"
    if hours and minutes:
        return f"{hours}h {minutes}m"
    if hours:
        return f"{hours} hour{'s' if hours != 1 else ''}"
    if minutes:
        return f"{minutes} min"
    return None

HOURS_RX   = re.compile(r"\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b", re.I)
WEEKS_RX   = re.compile(r"\b(\d+(?:\.\d+)?)\s*(?:weeks?|wks?)\b", re.I)
DAYS_RX    = re.compile(r"\b(\d+(?:\.\d+)?)\s*(?:days?)\b", re.I)
RUPEE_RX   = re.compile(r"(?:₹|INR)\s?([\d,]+)", re.I)
USD_RX     = re.compile(r"\$\s?([\d,]+(?:\.\d{2})?)")

def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()

def _find_json_ld(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    out = []
    for tag in soup.select('script[type="application/ld+json"]'):
        try:
            data = json.loads(tag.string or "{}")
            if isinstance(data, list):
                out.extend([d for d in data if isinstance(d, dict)])
            elif isinstance(data, dict):
                out.append(data)
        except Exception:
            continue
    return out

def _text_guess_duration(text: str) -> Optional[str]:
    if m := HOURS_RX.search(text):
        val = m.group(1)
        return f"{val} hour{'s' if val != '1' else ''}"
    if m := WEEKS_RX.search(text):
        val = m.group(1)
        return f"{val} week{'s' if val != '1' else ''}"
    if m := DAYS_RX.search(text):
        val = m.group(1)
        return f"{val} day{'s' if val != '1' else ''}"
    return None

def _guess_cost_by_provider(host: str, text: str) -> Optional[str]:
    h = host.lower()
    t = text.lower()
    if "youtube." in h or "kaggle." in h:
        return "Free"
    if "coursera." in h or "edx." in h:
        # many are audit-free
        return "Free to audit / Paid certificate"
    if "udemy." in h:
        # heavy discount culture; price numbers vary by region
        if RUPEE_RX.search(text) or USD_RX.search(text):
            # show a neutral label; exact price is region/time dependent
            return "Paid (often discounted)"
        return "Paid"
    return None

def _extract_from_ldjson(lds: List[Dict[str, Any]]) -> Dict[str, Optional[str]]:
    duration = None
    cost = None
    for ld in lds:
        # duration
        for key in ("timeRequired", "duration", "courseWorkload", "typicalAgeRange"):
            if key in ld and isinstance(ld[key], str):
                human = _iso_to_human(ld[key]) or _text_guess_duration(ld[key])
                if human:
                    duration = duration or human
        # offers / isAccessibleForFree / price
        offers = ld.get("offers")
        if isinstance(offers, dict):
            price = offers.get("price") or offers.get("lowPrice")
            currency = offers.get("priceCurrency") or ""
            if price:
                if currency.upper() in ("INR", "₹"):
                    cost = cost or f"₹{price}"
                else:
                    cost = cost or f"{currency} {price}".strip()
        if isinstance(offers, list):
            for o in offers:
                if isinstance(o, dict):
                    price = o.get("price") or o.get("lowPrice")
                    currency = o.get("priceCurrency") or ""
                    if price:
                        if currency.upper() in ("INR", "₹"):
                            cost = cost or f"₹{price}"
                        else:
                            cost = cost or f"{currency} {price}".strip()
        if isinstance(ld.get("isAccessibleForFree"), bool) and ld["isAccessibleForFree"]:
            cost = cost or "Free"
    return {"duration": duration, "cost": cost}

def _extract_generic(soup: BeautifulSoup) -> Dict[str, Optional[str]]:
    text = soup.get_text(" ", strip=True)
    duration = _text_guess_duration(text)

    # meta fallbacks
    meta = {}
    for m in soup.select("meta[property], meta[name], meta[itemprop]"):
        k = (m.get("property") or m.get("name") or m.get("itemprop") or "").lower()
        v = (m.get("content") or "").strip()
        if k and v:
            meta[k] = v

    if not duration:
        for k in ("duration", "video:duration", "og:video:duration"):
            if k in meta:
                # seconds → minutes/hours
                try:
                    secs = int(meta[k])
                    if secs >= 3600:
                        hours = round(secs / 3600, 1)
                        duration = f"{hours} hours"
                    else:
                        minutes = round(secs / 60)
                        duration = f"{minutes} min"
                except Exception:
                    pass

    # cost via visible price tokens
    cost = None
    if m := RUPEE_RX.search(text):
        cost = f"₹{m.group(1)}"
    elif m := USD_RX.search(text):
        cost = f"${m.group(1)}"

    return {"duration": duration, "cost": cost}

@lru_cache(maxsize=512)
def _fetch_html(url: str) -> str:
    # polite gap to avoid hammering on repeated calls (LRU + tiny delay)
    time.sleep(0.15)
    with _client() as cli:
        r = cli.get(url)
        r.raise_for_status()
        return r.text

def _enrich_one(title: str, link: Optional[str], source: Optional[str]) -> OutCourse:
    out = OutCourse(title=title, link=link, source=source)
    if not link:
        return out

    try:
        html = _fetch_html(link)
    except Exception:
        # No network/blocked/etc → give best-guess by provider only
        host = urlparse(link).netloc.lower()
        out.cost = _guess_cost_by_provider(host, "")
        return out

    soup = BeautifulSoup(html, "lxml")
    host = urlparse(link).netloc.lower()

    # 1) JSON-LD first (many providers expose canonical duration/price here)
    ld = _extract_from_ldjson(_find_json_ld(soup))
    # 2) Then meta/text heuristics
    gen = _extract_generic(soup)

    # merge with preference: ldjson first, then generic, then provider fallback
    duration = ld.get("duration") or gen.get("duration")
    cost     = ld.get("cost") or gen.get("cost")

    # provider bias/fallbacks
    cost = cost or _guess_cost_by_provider(host, soup.get_text(" ", strip=True))

    # Normalize tiny variants
    if duration:
        duration = _clean(duration)
    if cost:
        cost = _clean(cost)

    out.duration = duration
    out.cost = cost
    return out

# ──────────────────────────────────────────────────────────────────────────────
# Route
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/enrich-courses", response_model=EnrichResponse)
def enrich_courses(req: EnrichRequest) -> EnrichResponse:
    """
    Accepts a list of courses (title/link/source) and returns duration/cost if discoverable.
    - Uses JSON-LD, meta tags, visible text, and provider fallbacks.
    - Caches per-URL (LRU) to avoid repeated fetch.
    """
    if not req.courses:
        return EnrichResponse(courses=[])

    results: List[OutCourse] = []
    for c in req.courses:
        results.append(_enrich_one(c.title, str(c.link) if c.link else None, c.source))
    return EnrichResponse(courses=results)
