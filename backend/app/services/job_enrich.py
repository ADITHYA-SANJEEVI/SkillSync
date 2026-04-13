# backend/app/services/job_enrich.py
from __future__ import annotations
import asyncio, math, os
from typing import Any, List, Tuple, Optional

# Providers (lightweight)
try:
    from app.services.geocode_photon import photon_search  # returns (lat, lon, display) or None
except Exception:
    photon_search = None  # type: ignore
from app.services.geocode import geocode_india            # returns (lat, lon, display) or None

# Tunables (env override)
CONCURRENCY = int(os.getenv("GEO_CONCURRENCY", "6"))
PROVIDER_TIMEOUT = float(os.getenv("GEO_PROVIDER_TIMEOUT", "0.9"))   # per provider call
ROUND_TIMEOUT = float(os.getenv("GEO_ROUND_TIMEOUT", "1.6"))         # per query round

_sem = asyncio.Semaphore(CONCURRENCY)

def _jitter(lat: float, lon: float, i: int) -> Tuple[float, float]:
    meters = 6 + (i % 5) * 5
    d_lat = (meters / 111_320.0) * (1 if (i % 2) else -1)
    d_lon = (meters / (111_320.0 * max(0.2, math.cos(math.radians(max(-80.0, min(80.0, lat))))))) * (1 if (i % 3) else -1)
    return (lat + d_lat, lon + d_lon)

async def _with_timeout(coro, t: float):
    try:
        return await asyncio.wait_for(coro, timeout=t)
    except Exception:
        return None

async def _first_success(text: str) -> Optional[Tuple[float, float, str]]:
    # Run fast providers in parallel and take the first hit
    tasks = []
    if photon_search:
        tasks.append(_with_timeout(photon_search(text), PROVIDER_TIMEOUT))
    tasks.append(_with_timeout(geocode_india(text), PROVIDER_TIMEOUT))

    done, pending = await asyncio.wait(tasks, timeout=ROUND_TIMEOUT, return_when=asyncio.FIRST_COMPLETED)
    for p in pending:
        p.cancel()
    for d in done:
        try:
            res = d.result()
            if res:
                return res
        except Exception:
            pass
    return None

async def _resolve_for_job(j: Any, idx: int) -> None:
    async with _sem:
        city = getattr(j, "location_city", None)
        comp = getattr(j, "company", None)
        addr = getattr(j, "location_address", None)

        candidates: list[str] = []
        if addr and city: candidates.append(f"{addr}, {city}, India")
        if addr:          candidates.append(f"{addr}, India")
        if comp and city: candidates.append(f"{comp} {city}, India")
        if city:          candidates.append(f"{city}, India")

        for text in candidates:
            res = await _first_success(text)
            if res:
                lat, lon, disp = res
                j.location_lat, j.location_lon = lat, lon
                if not getattr(j, "location_address", None) and disp:
                    j.location_address = disp
                return

async def enrich_locations_inplace(jobs: List[Any]) -> None:
    if not jobs: 
        return
    # Kick off tasks only for items lacking good coords
    tasks = []
    for i, j in enumerate(jobs):
        try:
            lat = float(j.location_lat) if j.location_lat is not None else None
            lon = float(j.location_lon) if j.location_lon is not None else None
        except Exception:
            lat = lon = None
        if lat is None or lon is None:
            tasks.append(_resolve_for_job(j, i))

    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)

    # Jitter duplicates to unstack pins
    seen: dict[Tuple[float, float], List[int]] = {}
    for i, j in enumerate(jobs):
        try:
            key = (round(float(j.location_lat), 6), round(float(j.location_lon), 6))
            seen.setdefault(key, []).append(i)
        except Exception:
            pass
    for _, idxs in seen.items():
        if len(idxs) <= 1: 
            continue
        for k, i in enumerate(idxs):
            lat = float(jobs[i].location_lat); lon = float(jobs[i].location_lon)
            jobs[i].location_lat, jobs[i].location_lon = _jitter(lat, lon, k)
