# app/ml/catalog.py
from __future__ import annotations
import numpy as np
from .embeddings import get_embedder
import app.db.mongodb as mongo  # <- import module, access mongo.db at runtime


class Catalog:
    def __init__(self):
        self.embed = get_embedder()
        self.skill_items: list[str] = []
        self.role_names: list[str] = []
        self.courses: list[dict] = []
        self.skill_emb: np.ndarray | None = None
        self.role_emb: np.ndarray | None = None

    async def refresh_from_db(self) -> None:
        if mongo.db is None:
            # defensive: no DB yet
            self.skill_items, self.role_names, self.courses = [], [], []
            self.skill_emb, self.role_emb = None, None
            return

        # Load from Mongo
        skills_cur = mongo.db.skills.find({}, {"_id": 0, "name": 1})
        roles_cur  = mongo.db.roles.find({}, {"_id": 0, "title": 1})
        courses_cur= mongo.db.courses.find({}, {"_id": 0})

        self.skill_items = [s["name"] async for s in skills_cur]
        self.role_names  = [r["title"] async for r in roles_cur]
        self.courses     = [c async for c in courses_cur]

        # Encode (normalized)
        self.skill_emb = (
            np.asarray(self.embed.encode(self.skill_items, normalize_embeddings=True), dtype="float32")
            if self.skill_items else None
        )
        self.role_emb = (
            np.asarray(self.embed.encode(self.role_names, normalize_embeddings=True), dtype="float32")
            if self.role_names else None
        )

        if self.courses:
            texts = [f'{c.get("title","")}. {c.get("desc","")}' for c in self.courses]
            embs = self.embed.encode(texts, normalize_embeddings=True)
            for vec, c in zip(embs, self.courses):
                c["embedding"] = np.asarray(vec, dtype="float32")


CATALOG = Catalog()
