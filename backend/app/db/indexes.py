# app/db/indexes.py
from __future__ import annotations

from typing import List, Tuple, Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorCollection


KeySpec = List[Tuple[str, int]]  # e.g., [("name", 1)]


def _normalize_keys(keys: KeySpec) -> tuple[tuple[str, int], ...]:
    # Normalize for comparison
    return tuple(keys)


async def _ensure_index(
    coll: AsyncIOMotorCollection,
    keys: KeySpec,
    name: str,
    unique: Optional[bool] = None,
    **kwargs: Any,
) -> None:
    """
    Idempotent & conflict-proof index creator (async Motor version).

    Cases handled:
    - Same name exists:
        - If same keys & (unique matches OR unique not specified) -> OK
        - Else drop and recreate with desired spec
    - Different name exists with same keys:
        - If unique matches -> keep existing (skip creating new named one)
        - If unique differs -> drop existing and create with desired spec+name
    - No matching index -> create with desired spec+name
    """
    info: Dict[str, Any] = await coll.index_information()  # motor: awaitable
    desired_keys = _normalize_keys(keys)
    desired_unique = (bool(unique) if unique is not None else None)

    # 1) Check existing by name
    existing_named = info.get(name)
    if existing_named:
        existing_keys = _normalize_keys(existing_named.get("key", []))  # type: ignore[arg-type]
        existing_unique = existing_named.get("unique", False)
        keys_equal = (existing_keys == desired_keys)
        unique_equal = (desired_unique is None) or (existing_unique == desired_unique)
        if keys_equal and unique_equal:
            return  # all good
        await coll.drop_index(name)

    # 2) Any index with same keys?
    same_keys_name = None
    same_keys_unique = None
    for iname, spec in info.items():
        ek = _normalize_keys(spec.get("key", []))  # type: ignore[arg-type]
        if ek == desired_keys:
            same_keys_name = iname
            same_keys_unique = spec.get("unique", False)
            break

    if same_keys_name:
        if (desired_unique is None) or (same_keys_unique == desired_unique):
            # Same keys + acceptable unique => keep existing (avoid name clash)
            return
        # Same keys but unique differs => drop and recreate
        await coll.drop_index(same_keys_name)

    # 3) Create with desired options
    opts: Dict[str, Any] = {"name": name}
    if unique is not None:
        opts["unique"] = unique
    opts.update(kwargs)
    await coll.create_index(keys, **opts)


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """
    Create helpful indexes. Safe to call multiple times.
    Add/adjust here as your collections grow.
    """
    # Existing ones from your code
    await _ensure_index(
        db.resumes,  # type: ignore[attr-defined]
        keys=[("user_id", 1)],
        name="resumes_user",
        unique=True,
    )
    await _ensure_index(
        db.matches,  # type: ignore[attr-defined]
        keys=[("user_id", 1)],
        name="matches_user",
        unique=True,
    )

    # Useful for ML seeds / lookups
    await _ensure_index(
        db.skills,  # type: ignore[attr-defined]
        keys=[("name", 1)],
        name="skills_name_unique",
        unique=True,
    )
    await _ensure_index(
        db.roles,  # type: ignore[attr-defined]
        keys=[("title", 1)],
        name="roles_title_unique",
        unique=True,
    )
    await _ensure_index(
        db.courses,  # type: ignore[attr-defined]
        keys=[("id", 1)],
        name="courses_id_unique",
        unique=True,
    )
    # Optional convenience indexes
    await _ensure_index(
        db.jobs,  # type: ignore[attr-defined]
        keys=[("title", 1)],
        name="jobs_title",
    )
    await _ensure_index(
        db.candidates,  # type: ignore[attr-defined]
        keys=[("user_id", 1)],
        name="candidates_user",
    )
