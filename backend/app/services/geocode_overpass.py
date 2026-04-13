# app/services/geocode_overpass.py
from __future__ import annotations
import asyncio, time
from typing import Optional, Tuple, Dict
import httpx

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
_RATE_LOCK = asyncio.Lock()
_LAST_TS = 0.0
_CACHE: Dict[str, Tuple[float, float, str]] = {}

def _norm(s: str) -> str:
    return " ".join((s or "").strip().lower().split())

async def _polite_delay() -> None:
    global _LAST_TS
    async with _RATE_LOCK:
        now = time.monotonic()
        if (now - _LAST_TS) < 1.0:  # be extra kind to Overpass
            await asyncio.sleep(1.0 - (now - _LAST_TS))
        _LAST_TS = time.monotonic()

def _build_query(name: str, city: str|None) -> str:
    # Restrict to India; try office/amenity/company names; fallback to generic name
    # Note: This is intentionally simple to avoid heavy queries.
    name_q = name.replace('"', '\\"')
    city_filter = f'["addr:city"~"{city}",i]' if city else ""
    return f"""
[out:json][timeout:10];
area["name"="India"]["boundary"="administrative"]; ->.in;
(
  node(area.in)["name"~"{name_q}",i]{city_filter};
  way(area.in)["name"~"{name_q}",i]{city_filter};
  relation(area.in)["name"~"{name_q}",i]{city_filter};
);
out center 1;
"""

async def overpass_lookup(name: str, city: str|None) -> Optional[Tuple[float, float, str]]:
    key = _norm(f"overpass:{name}|{city or ''}")
    if key in _CACHE: return _CACHE[key]
    await _polite_delay()
    try:
        q = _build_query(name, city)
        async with httpx.AsyncClient(timeout=12.0) as cx:
            r = await cx.post(OVERPASS_URL, data={"data": q})
            r.raise_for_status()
            data = r.json()
            els = (data or {}).get("elements") or []
            if not els: return None
            top = els[0]
            # nodes have lat/lon; ways/relations have center
            if "lat" in top and "lon" in top:
                lat, lon = float(top["lat"]), float(top["lon"])
            elif "center" in top:
                lat, lon = float(top["center"]["lat"]), float(top["center"]["lon"])
            else:
                return None
            disp = (top.get("tags") or {}).get("name") or name
            _CACHE[key] = (lat, lon, disp)
            return _CACHE[key]
    except Exception:
        return None
