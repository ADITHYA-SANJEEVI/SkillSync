# backend/app/ml/geo_enrich.py
from __future__ import annotations
import os
import re
import sqlite3
import time
from typing import Any, Dict, Iterable, List, Optional, Tuple

import anyio
import httpx

# ─────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────
DB_PATH = os.getenv("JOBFEED_GEO_DB", "backend/app/data/geocode_cache.sqlite")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

HTTP_TIMEOUT = float(os.getenv("HTTP_TIMEOUT", "15"))
NOMINATIM_EMAIL = os.getenv("NOMINATIM_EMAIL", "")
UA = f"JobGapFSD/1.0 ({NOMINATIM_EMAIL})" if NOMINATIM_EMAIL else "JobGapFSD/1.0"

# polite 1 rps per provider
THROTTLE_SECONDS = 1.0
_last_nom_ts = 0.0
_last_pho_ts = 0.0

# Chennai & friends; expand as needed
LOCALITY_HINTS: Dict[str, List[str]] = {
    "chennai": [
        "siruseri", "omr", "old mahabalipuram road", "tidel park", "guindy",
        "sholinganallur", "perungudi", "ambattur", "velachery", "tharamani",
        "navalur", "tambaram", "porur"
    ],
    "bengaluru": [
        "whitefield", "electronic city", "bellandur", "marathahalli",
        "outer ring road", "sarjapur", "hsr layout", "indiranagar"
    ],
    "hyderabad": [
        "hitec city", "gachibowli", "madhapur", "kondapur", "kukatpally"
    ],
    "pune": ["hinjewadi", "kharadi", "magarpatta", "baner", "viman nagar"],
    "mumbai": ["bkc", "bandra kurla complex", "powai", "andheri", "thane"],
    "gurgaon": ["cyber city", "sector", "ugc", "uhg", "golf course road", "sohna road"],
    "gurugram": ["cyber city", "sector", "golf course road", "sohna road"],
    "delhi": ["dwarka", "okhla", "sakét", "connaught place"],
}

# fast regex for locality extraction
LOCALITY_RX: Dict[str, re.Pattern] = {
    city: re.compile(r"\b(" + "|".join(map(re.escape, hints)) + r")\b", re.I)
    for city, hints in LOCALITY_HINTS.items()
}

CITY_NORMALIZE = {
    "bangalore": "bengaluru",
    "gurgaon": "gurugram",
}

# ─────────────────────────────────────────────────────────────
# SQLite cache
# ─────────────────────────────────────────────────────────────
def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS geocode_cache (
        cache_key     TEXT PRIMARY KEY,
        lat           REAL,
        lon           REAL,
        display_name  TEXT,
        updated_at    INTEGER
    )
    """)
    return conn

def _mk_key(company: Optional[str], locality: Optional[str], city: Optional[str], region: Optional[str]) -> str:
    c = (company or "").strip().lower()
    l = (locality or "").strip().lower()
    ci = (city or "").strip().lower()
    rg = (region or "").strip().lower()
    # stable, locality-aware key
    return f"{c}|{l}|{ci}|{rg}|india"

def cache_get(company: Optional[str], locality: Optional[str], city: Optional[str], region: Optional[str]) -> Optional[Tuple[float, float, str]]:
    key = _mk_key(company, locality, city, region)
    with _db() as conn:
        cur = conn.execute("SELECT lat, lon, display_name FROM geocode_cache WHERE cache_key = ?", (key,))
        row = cur.fetchone()
        if row:
            return float(row[0]), float(row[1]), str(row[2] or "")
    return None

def cache_put(company: Optional[str], locality: Optional[str], city: Optional[str], region: Optional[str],
              lat: float, lon: float, display_name: str) -> None:
    key = _mk_key(company, locality, city, region)
    ts = int(time.time())
    with _db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO geocode_cache (cache_key, lat, lon, display_name, updated_at) VALUES (?, ?, ?, ?, ?)",
            (key, lat, lon, display_name, ts),
        )

# ─────────────────────────────────────────────────────────────
# Locality extraction
# ─────────────────────────────────────────────────────────────
def normalize_city(city: Optional[str]) -> Optional[str]:
    if not city: return None
    c = city.strip().lower()
    return CITY_NORMALIZE.get(c, c)

def extract_locality(title: str, desc: str, city: Optional[str]) -> Optional[str]:
    text = f"{title or ''} {desc or ''}".lower()
    c = normalize_city(city)
    if c and c in LOCALITY_RX:
        m = LOCALITY_RX[c].search(text)
        if m:
            return m.group(1)
    # cross-city fallbacks if city not recognized
    for rx in LOCALITY_RX.values():
        m = rx.search(text)
        if m:
            return m.group(1)
    return None

# ─────────────────────────────────────────────────────────────
# Providers (free, no key required)
# ─────────────────────────────────────────────────────────────
async def _throttle(provider: str) -> None:
    global _last_nom_ts, _last_pho_ts
    now = time.time()
    if provider == "nominatim":
        gap = now - _last_nom_ts
        if gap < THROTTLE_SECONDS:
            await anyio.sleep(THROTTLE_SECONDS - gap)
        _last_nom_ts = time.time()
    else:
        gap = now - _last_pho_ts
        if gap < THROTTLE_SECONDS:
            await anyio.sleep(THROTTLE_SECONDS - gap)
        _last_pho_ts = time.time()

async def geocode_nominatim(query: str) -> Optional[Tuple[float, float, str]]:
    await _throttle("nominatim")
    url = "https://nominatim.openstreetmap.org/search"
    headers = {"Accept": "application/json", "User-Agent": UA, "Referer": "http://localhost/"}
    params = {"format": "json", "q": query, "limit": 1, "addressdetails": 1}
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            r = await client.get(url, params=params, headers=headers)
            r.raise_for_status()
            data = r.json()
            if isinstance(data, list) and data:
                lat = data[0].get("lat"); lon = data[0].get("lon")
                if lat and lon:
                    return float(lat), float(lon), str(data[0].get("display_name") or query)
    except Exception:
        return None
    return None

async def geocode_photon(query: str) -> Optional[Tuple[float, float, str]]:
    await _throttle("photon")
    # Photon (Komoot) — OSM-based, no key
    url = "https://photon.komoot.io/api/"
    params = {"q": query, "limit": 1, "lang": "en"}
    headers = {"Accept": "application/json", "User-Agent": UA}
    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
            r = await client.get(url, params=params, headers=headers)
            r.raise_for_status()
            data = r.json()
            if isinstance(data, dict) and data.get("features"):
                f = data["features"][0]
                coords = f.get("geometry", {}).get("coordinates")
                if coords and len(coords) >= 2:
                    lon, lat = coords[0], coords[1]
                    name = f.get("properties", {}).get("name") or f.get("properties", {}).get("osm_id") or query
                    return float(lat), float(lon), str(name)
    except Exception:
        return None
    return None

async def geocode_cascade(company: Optional[str], locality: Optional[str], city: Optional[str], region: Optional[str]) -> Optional[Tuple[float, float, str]]:
    # Construct smarter query: "Company, Locality, City, Region, India"
    parts = [p for p in [company, locality, city, region, "India"] if p]
    if not parts:
        return None
    q = ", ".join(parts)

    # Try cache first
    cached = cache_get(company, locality, city, region)
    if cached:
        return cached

    # Providers: Nominatim → Photon
    for provider in (geocode_nominatim, geocode_photon):
        result = await provider(q)
        if result:
            lat, lon, name = result
            cache_put(company, locality, city, region, lat, lon, name)
            return result
    return None

# ─────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────
def looks_like_city_centroid(lat: Optional[float], lon: Optional[float]) -> bool:
    # Chennai centroid as observed; can extend with more if needed
    return (
        isinstance(lat, (int, float)) and isinstance(lon, (int, float)) and
        abs(lat - 13.06041) < 1e-5 and abs(lon - 80.24963) < 1e-5
    )

async def enrich_job_locations(jobs: Iterable[Any], force: bool = False) -> None:
    """
    Mutates items in-place. Each job must have attributes or dict-keys:
      title, short_desc/description, company, location_city, location_region,
      location_lat, location_lon, location_address
    """
    for j in jobs:
        # Access tolerant of both pydantic model and dict-like
        g = (lambda k, default=None: getattr(j, k, getattr(j, k, default)) if hasattr(j, k) else (j.get(k, default) if isinstance(j, dict) else default))
        s = (lambda k, v: setattr(j, k, v) if hasattr(j, k) else (j.__setitem__(k, v) if isinstance(j, dict) else None))

        lat = g("location_lat")
        lon = g("location_lon")

        if not force and lat is not None and lon is not None and not looks_like_city_centroid(lat, lon):
            continue  # keep provider coords if they look specific

        title = g("title", "") or ""
        desc  = g("short_desc", "") or g("description", "") or ""
        company = g("company", None)
        city = g("location_city", None)
        region = g("location_region", None)

        locality = extract_locality(title, desc, city)
        res = await geocode_cascade(company, locality, city, region)
        if res:
            new_lat, new_lon, dn = res
            s("location_lat", new_lat)
            s("location_lon", new_lon)
            if not g("location_address"):
                s("location_address", dn)
