# app/services/geocode_wikidata.py
from __future__ import annotations
import asyncio, time
from typing import Optional, Tuple, Dict
import httpx

WD_SPARQL = "https://query.wikidata.org/sparql"
_UA = "job-gap-fsd/1.0 (coords via Wikidata; mailto:you@example.com)"
_RATE_LOCK = asyncio.Lock()
_LAST_TS = 0.0
_CACHE: Dict[str, Tuple[float, float, str]] = {}

def _norm(s: str) -> str: return " ".join((s or "").strip().lower().split())

async def _polite_delay():
    global _LAST_TS
    async with _RATE_LOCK:
        now = time.monotonic()
        if (now - _LAST_TS) < 1.0:
            await asyncio.sleep(1.0 - (now - _LAST_TS))
        _LAST_TS = time.monotonic()

async def wikidata_coords(company: str, city_hint: str|None) -> Optional[Tuple[float, float, str]]:
    key = _norm(f"wikidata:{company}|{city_hint or ''}")
    if key in _CACHE: return _CACHE[key]
    await _polite_delay()
    # Simple fuzzy-ish query: label match + coord; prefer India via country or city hint in label
    company_q = company.replace('"', '\\"')
    city_q = (city_hint or "").replace('"', '\\"')
    sparql = f"""
SELECT ?item ?itemLabel ?coord WHERE {{
  ?item rdfs:label "{company_q}"@en.
  ?item wdt:P625 ?coord.
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }}
}}
LIMIT 1
"""
    try:
        async with httpx.AsyncClient(timeout=10.0, headers={"User-Agent": _UA}) as cx:
            r = await cx.get(WD_SPARQL, params={"query": sparql, "format": "json"})
            r.raise_for_status()
            data = r.json()
            b = (((data or {}).get("results") or {}).get("bindings") or [])
            if not b: return None
            coord = b[0]["coord"]["value"]  # "Point(lon lat)"
            parts = coord.replace("Point(", "").replace(")", "").split()
            lon, lat = float(parts[0]), float(parts[1])
            name = b[0]["itemLabel"]["value"]
            _CACHE[key] = (lat, lon, name)
            return _CACHE[key]
    except Exception:
        return None
