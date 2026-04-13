# app/ml/embeddings.py
from __future__ import annotations
import os
from functools import lru_cache
from sentence_transformers import SentenceTransformer

# You can change this via .env: EMBED_MODEL=sentence-transformers/all-MiniLM-L6-v2
MODEL_NAME = os.getenv("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

@lru_cache(maxsize=1)
def get_embedder() -> SentenceTransformer:
    """
    Singleton SentenceTransformer loader.
    Cached so model loads once per process.
    """
    return SentenceTransformer(MODEL_NAME)
