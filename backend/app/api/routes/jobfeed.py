# backend/app/api/routes/jobfeed.py
from __future__ import annotations
from typing import Optional, List, Literal, Tuple
import os, urllib.parse, re
from datetime import datetime

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
import httpx

# NEW: import the enrichment helpers
from app.ml.geo_enrich import enrich_job_locations, looks_like_city_centroid

router = APIRouter(prefix="/api/v1/jobfeed", tags=["jobfeed"])

# ---------- Models ----------
class Salary(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None
    currency: Optional[str] = None
    period: Optional[Literal["year","month","day","hour"]] = None

class JobCard(BaseModel):
    id: str
    source: Literal["adzuna"] = "adzuna"
    title: str
    company: Optional[str] = None
    location_city: Optional[str] = None
    location_region: Optional[str] = None
    location_country: Optional[str] = "India"
    location_lat: Optional[float] = None
    location_lon: Optional[float] = None
    location_address: Optional[str] = None
    mode: Optional[Literal["onsite","remote","hybrid"]] = None
    work_type: Optional[Literal["full-time","part-time","contract","internship","temporary","other"]] = None
    salary: Optional[Salary] = None
    posted_at: Optional[str] = None
    apply_url: str
    short_desc: Optional[str] = None
    tags: List[str] = []

class FeedResponse(BaseModel):
    provider: str = "adzuna"
    total: Optional[int] = None
    page: int
    per_page: int
    jobs: List[JobCard]

# ---------- Small helpers ----------
TAG_SPLIT = re.compile(r"[,\|/•·\-\u2022]")
def _truncate(s: Optional[str], n: int = 240) -> Optional[str]:
    if not s: return s
    s = re.sub(r"\s+", " ", s).strip()
    return s if len(s) <= n else s[:n-1].rstrip() + "…"

def _infer_mode(text: str) -> Optional[str]:
    t = text.lower()
    if "hybrid" in t: return "hybrid"
    if "remote" in t or "work from home" in t or "wfh" in t: return "remote"
    return "onsite"

def _infer_work_type(text: str) -> Optional[str]:
    t = text.lower()
    if "intern" in t: return "internship"
    if "contract" in t: return "contract"
    if "part-time" in t or "part time" in t: return "part-time"
    if "temporary" in t or "temp" in t: return "temporary"
    if "full-time" in t or "full time" in t: return "full-time"
    return None

def _pick_tags(title: str, desc: str, q: str) -> List[str]:
    base = set()
    for token in TAG_SPLIT.split(title + " | " + desc):
        token = token.strip()
        if len(token) <= 2: continue
        if re.match(r"^[A-Za-z][A-Za-z0-9\+\#\.]{2,}$", token):
            if token.lower() not in {"the","and","with","for","from","you","your","our"}:
                base.add(token)
    base.update([t for t in re.split(r"\s+", q or "") if len(t) > 2])
    return sorted(base)[:8]

def _get_adzuna_cfg() -> Tuple[str, str, str, float]:
    app_id  = os.getenv("ADZUNA_APP_ID", "")
    app_key = os.getenv("ADZUNA_APP_KEY", "")
    country = os.getenv("ADZUNA_COUNTRY", "IN").lower()
    timeout = float(os.getenv("HTTP_TIMEOUT", "15"))
    if not app_id or not app_key:
        raise HTTPException(500, "Adzuna not configured (set ADZUNA_APP_ID and ADZUNA_APP_KEY)")
    return app_id, app_key, country, timeout

# ---------- Provider ----------
async def _adzuna(q: Optional[str], location: Optional[str], page: int, per_page: int,
                  only_remote: Optional[bool], only_intern: bool) -> FeedResponse:
    app_id, app_key, country, timeout = _get_adzuna_cfg()
    params = {"app_id": app_id, "app_key": app_key, "results_per_page": per_page}
    if q:        params["what"]  = q
    if location: params["where"] = location

    url = f"https://api.adzuna.com/v1/api/jobs/{country}/search/{page}?{urllib.parse.urlencode(params)}"
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(url, headers={"Accept": "application/json"}, timeout=timeout)
            r.raise_for_status()
            data = r.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(502, detail={"url": str(e.request.url), "status": e.response.status_code, "body": e.response.text})
    except Exception as e:
        raise HTTPException(502, detail=f"Adzuna request failed: {e}")

    jobs: List[JobCard] = []
    for it in data.get("results", []):
        title = it.get("title") or ""
        desc  = it.get("description") or ""
        company = (it.get("company") or {}).get("display_name")
        loc = it.get("location") or {}
        area = loc.get("area") or []
        country_name = area[0] if len(area) > 0 else "India"
        region  = area[1] if len(area) > 1 else None
        city    = area[2] if len(area) > 2 else loc.get("display_name")
        lat = it.get("latitude"); lon = it.get("longitude")
        address = loc.get("display_name")

        combined = f"{title} {desc}"
        mode = _infer_mode(combined)
        wtype = _infer_work_type(combined)
        if only_remote is True and mode != "remote":   continue
        if only_remote is False and mode == "remote":  continue
        if only_intern and wtype != "internship":      continue

        salary = Salary(
            min=it.get("salary_min"),
            max=it.get("salary_max"),
            currency=it.get("salary_currency"),
            period=(it.get("salary_period") or None),
        )

        jobs.append(JobCard(
            id=str(it.get("id")),
            title=title,
            company=company,
            location_city=city,
            location_region=region,
            location_country=country_name,
            location_lat=float(lat) if isinstance(lat, (int, float)) else None,
            location_lon=float(lon) if isinstance(lon, (int, float)) else None,
            location_address=address if isinstance(address, str) else None,
            mode=mode,
            work_type=wtype,
            salary=salary if any([salary.min, salary.max]) else None,
            posted_at=it.get("created"),
            apply_url=it.get("redirect_url") or "",
            short_desc=_truncate(desc),
            tags=_pick_tags(title, desc, q or ""),
        ))

    # sort newest first
    def sort_key(j: JobCard):
        ts = 0.0
        if j.posted_at:
            try:
                ts = datetime.fromisoformat(j.posted_at.replace("Z","")).timestamp()
            except Exception:
                pass
        return -ts

    jobs.sort(key=sort_key)
    return FeedResponse(provider="adzuna", total=data.get("count"), page=page, per_page=per_page, jobs=jobs)

# ---------- Route ----------
@router.get("/ping")
async def ping():
    return {"ok": True}

@router.get("/feed", response_model=FeedResponse)
async def jobs_feed(
    q: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(15, ge=1, le=50),
    mode: Optional[Literal["any","remote","onsite","hybrid"]] = Query("any"),
    internship: bool = Query(False),
    enrich: bool = Query(False),
):
    only_remote = None
    if mode == "remote":  only_remote = True
    if mode == "onsite":  only_remote = False

    resp = await _adzuna(q, location, page, per_page, only_remote, internship)

    # Respect either env flag (JOBFEED_ENRICH_LOC=1) or query param ?enrich=true
    ENRICH_LOC_FLAG = os.getenv("JOBFEED_ENRICH_LOC", "0") == "1"
    FORCE_GEOCODE   = os.getenv("JOBFEED_FORCE_GEOCODE", "0") == "1"

    if ENRICH_LOC_FLAG or enrich:
        # Only geocode if absent or centroid, unless FORCE_GEOCODE=1
        if FORCE_GEOCODE:
            await enrich_job_locations(resp.jobs, force=True)
        else:
            # selective: only when missing or centroidy
            subset = [j for j in resp.jobs if j.location_lat is None or j.location_lon is None or looks_like_city_centroid(j.location_lat, j.location_lon)]
            await enrich_job_locations(subset, force=False)

    return resp
