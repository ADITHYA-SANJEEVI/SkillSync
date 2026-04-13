# app/services/geocode_photon.py
from __future__ import annotations
import asyncio, time
from typing import Optional, Tuple, Dict
import httpx

PHOTON_URL = "https://photon.komoot.io/api"
_RATE_LOCK = asyncio.Lock()
_LAST_TS = 0.0
_CACHE: Dict[str, Tuple[float, float, str]] = {}

def _norm(q: str) -> str:
    return " ".join((q or "").strip().lower().split())

async def _polite_delay() -> None:
    global _LAST_TS
    async with _RATE_LOCK:
        now = time.monotonic()
        if (now - _LAST_TS) < 0.25:  # ~4 qps
            await asyncio.sleep(0.25 - (now - _LAST_TS))
        _LAST_TS = time.monotonic()

async def photon_search(q: str) -> Optional[Tuple[float, float, str]]:
    """
    Free OSM-backed text search. Returns (lat, lon, display).
    """
    key = _norm(f"photon:{q}")
    if key in _CACHE: return _CACHE[key]
    await _polite_delay()
    try:
        async with httpx.AsyncClient(timeout=6.0) as cx:
            r = await cx.get(PHOTON_URL, params={"q": q, "lang": "en"})
            r.raise_for_status()
            data = r.json()
            feats = (data or {}).get("features") or []
            if feats:
                top = feats[0]
                coords = top["geometry"]["coordinates"]  # [lon, lat]
                lon, lat = float(coords[0]), float(coords[1])
                name = (top.get("properties") or {}).get("name") or q
                disp = name
                _CACHE[key] = (lat, lon, disp)
                return _CACHE[key]
    except Exception:
        return None
    return None
