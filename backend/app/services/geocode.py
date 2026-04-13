# backend/app/services/geocode.py
from __future__ import annotations
import asyncio, time
from typing import Optional, Tuple, Dict
import httpx
import os

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = os.getenv("GEO_USER_AGENT", "JobGapFSD/1.0 (mailto:example@example.com)")

_CACHE: Dict[str, Tuple[float, float, str]] = {}
_LOCK = asyncio.Lock()
_LAST = 0.0  # polite 1 rps

def _norm(s: str) -> str: return " ".join((s or "").strip().lower().split())

async def _polite_delay():
    global _LAST
    async with _LOCK:
        now = time.monotonic()
        if (now - _LAST) < 1.05:
            await asyncio.sleep(1.05 - (now - _LAST))
        _LAST = time.monotonic()

async def geocode_india(q: str) -> Optional[Tuple[float, float, str]]:
    """
    Return (lat, lon, display) for a free-text query, constrained to India.
    """
    key = _norm(q)
    if not key: return None
    if key in _CACHE: return _CACHE[key]

    await _polite_delay()
    params = {"format": "json", "q": q, "countrycodes": "in", "limit": 1, "addressdetails": 0}
    headers = {"Accept": "application/json", "User-Agent": USER_AGENT}
    try:
        async with httpx.AsyncClient(timeout=10.0) as cx:
            r = await cx.get(NOMINATIM_URL, params=params, headers=headers)
            r.raise_for_status()
            data = r.json()
            if isinstance(data, list) and data:
                lat = float(data[0]["lat"]); lon = float(data[0]["lon"])
                disp = str(data[0].get("display_name", q))
                _CACHE[key] = (lat, lon, disp)
                return _CACHE[key]
    except Exception:
        return None
