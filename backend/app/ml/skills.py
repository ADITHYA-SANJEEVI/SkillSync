from keybert import KeyBERT
import numpy as np
from .embeddings import get_embedder
from .catalog import CATALOG

_kw = KeyBERT()
_embed = get_embedder()

def extract_skill_candidates(text: str, top_n: int = 20):
    phrases = _kw.extract_keywords(text, keyphrase_ngram_range=(1,3), stop_words="english", top_n=top_n)
    return [p[0].lower() for p in phrases]

def normalize_to_catalog(candidates):
    if not candidates: return []
    cand_emb = _embed.encode(candidates, normalize_embeddings=True)
    sims = cand_emb @ CATALOG.skill_emb.T
    idx = np.argmax(sims, axis=1)
    chosen = {CATALOG.skill_items[j] for i, j in enumerate(idx) if sims[i, j] >= 0.55}
    return sorted(chosen)

def closest_role(text: str):
    v = _embed.encode([text], normalize_embeddings=True)[0]
    sims = v @ CATALOG.role_emb.T
    j = int(np.argmax(sims))
    return CATALOG.role_names[j], float(sims[j])
