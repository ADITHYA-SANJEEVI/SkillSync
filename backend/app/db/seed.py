# app/db/seed.py
from __future__ import annotations

import csv
import json
import logging
from pathlib import Path
from typing import Any, Dict, List
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import UpdateOne

log = logging.getLogger("app.seed")

# === PATH RESOLUTION ===
# This ensures we always find db/seeds/ at project root,
# no matter where the backend folder is located.
PROJECT_ROOT = Path(__file__).resolve().parents[3]  # Goes up to job-gap-fsd/
SEEDS_DIR = PROJECT_ROOT / "db" / "seeds"

SKILLS_CSV = SEEDS_DIR / "skills.csv"
ROLES_CSV = SEEDS_DIR / "roles.csv"
COURSES_JSON = SEEDS_DIR / "courses.sample.json"


# === HELPERS ===
def _load_csv_firstcol(path: Path) -> List[str]:
    if not path.exists():
        log.warning(f"Seed file not found: {path}")
        return []
    items: List[str] = []
    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        for row in reader:
            if not row:
                continue
            val = (row[0] or "").strip()
            if val:
                items.append(val)
    return items


def _load_json(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        log.warning(f"Seed file not found: {path}")
        return []
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
        if isinstance(data, list):
            return data
        elif isinstance(data, dict):
            return [data]
    return []


# === SEED FUNCTIONS ===
async def _seed_skills(db: AsyncIOMotorDatabase) -> Dict[str, int]:
    """Upsert skills by unique key: name (lowercased)."""
    rows = _load_csv_firstcol(SKILLS_CSV)
    if not rows:
        return {"found": 0, "upserts": 0}

    ops: List[UpdateOne] = []
    for raw in rows:
        name = raw.strip().lower()
        if not name:
            continue
        ops.append(
            UpdateOne(
                {"name": name},
                {"$setOnInsert": {"name": name}},
                upsert=True,
            )
        )

    if not ops:
        return {"found": len(rows), "upserts": 0}

    res = await db.skills.bulk_write(ops, ordered=False)
    upserts = res.upserted_count or 0
    return {"found": len(rows), "upserts": upserts}


async def _seed_roles(db: AsyncIOMotorDatabase) -> Dict[str, int]:
    """Upsert roles by unique key: title (exact)."""
    rows = _load_csv_firstcol(ROLES_CSV)
    if not rows:
        return {"found": 0, "upserts": 0}

    ops: List[UpdateOne] = []
    for raw in rows:
        title = raw.strip()
        if not title:
            continue
        ops.append(
            UpdateOne(
                {"title": title},
                {"$setOnInsert": {"title": title}},
                upsert=True,
            )
        )

    if not ops:
        return {"found": len(rows), "upserts": 0}

    res = await db.roles.bulk_write(ops, ordered=False)
    upserts = res.upserted_count or 0
    return {"found": len(rows), "upserts": upserts}


def _normalize_course(c: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure each course has an id, normalized skills, and basic fields."""
    course = dict(c)  # shallow copy

    # id
    if not course.get("id"):
        base = (course.get("provider", "") + "|" + course.get("title", "")).strip()
        course["id"] = base if base else f"course-{uuid4().hex}"

    # normalize skills
    skills = course.get("skills", [])
    if isinstance(skills, list):
        course["skills"] = [str(s).strip().lower() for s in skills if str(s).strip()]
    else:
        course["skills"] = []

    # defaults
    course.setdefault("title", "Untitled")
    course.setdefault("provider", "Unknown")
    course.setdefault("url", "")
    course.setdefault("desc", "")

    return course


async def _seed_courses(db: AsyncIOMotorDatabase) -> Dict[str, int]:
    """Upsert courses by unique key: id or (provider+title)."""
    rows = _load_json(COURSES_JSON)
    if not rows:
        return {"found": 0, "upserts": 0}

    ops: List[UpdateOne] = []
    for c in rows:
        c = _normalize_course(c)
        _id = c["id"]
        ops.append(
            UpdateOne(
                {"id": _id},
                {
                    "$setOnInsert": {
                        "id": _id,
                        "title": c["title"],
                        "provider": c["provider"],
                        "url": c["url"],
                        "skills": c["skills"],
                        "desc": c["desc"],
                    }
                },
                upsert=True,
            )
        )

    if not ops:
        return {"found": len(rows), "upserts": 0}

    res = await db.courses.bulk_write(ops, ordered=False)
    upserts = res.upserted_count or 0
    return {"found": len(rows), "upserts": upserts}


# === MAIN SEED WRAPPER ===
async def seed_if_needed(db: AsyncIOMotorDatabase) -> Dict[str, Dict[str, int]]:
    """
    Idempotent seeding:
      - If collections are empty, insert seeds.
      - If not empty, upsert ensures no duplicates.
    """
    # Ensure collections exist by touching them once
    for col in ["skills", "roles", "courses"]:
        await db[col].insert_one({"_tmp": True})
        await db[col].delete_one({"_tmp": True})

    # Perform upserts
    skills_summary = await _seed_skills(db)
    roles_summary = await _seed_roles(db)
    courses_summary = await _seed_courses(db)

    summary = {
        "skills": skills_summary,
        "roles": roles_summary,
        "courses": courses_summary,
    }

    log.info(
        "Seed summary | skills: %s, roles: %s, courses: %s",
        skills_summary, roles_summary, courses_summary
    )
    return summary
