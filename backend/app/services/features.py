# backend/app/services/features.py
from __future__ import annotations
import re, json
from pathlib import Path
from typing import List, Dict, Iterable
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# -------- Text utils --------
_WS = re.compile(r"\s+")
_ALNUM = re.compile(r"[^a-z0-9+#.\- ]+")

def normalize_text(text: str) -> str:
    t = (text or "").lower()
    t = _ALNUM.sub(" ", t)
    t = _WS.sub(" ", t).strip()
    return t

# -------- Skills taxonomy --------
def load_taxonomy() -> List[str]:
    data_dir = Path(__file__).resolve().parents[1] / "data"
    skills_path = data_dir / "skills_taxonomy.json"
    if skills_path.exists():
        try:
            return json.loads(skills_path.read_text(encoding="utf-8"))
        except Exception:
            pass
    # fallback mini set
    return [
        "python","pandas","numpy","scikit-learn","xgboost","pytorch","tensorflow","sql",
        "docker","kubernetes","aws","gcp","azure","nlp","computer vision","mlops","spark",
        "flask","django","fastapi","airflow","kafka","git","linux","react","node","java",
        "c++","c#","typescript","mongodb","postgres","mysql","hadoop","spark"
    ]

def extract_skills(text: str, taxonomy: Iterable[str]) -> List[str]:
    """Very fast heuristic extractor: token match for single-words, substring for multi-words."""
    t = (text or "").lower()
    toks = set(re.findall(r"[a-z0-9+#.\-]+", t))
    found = []
    for term in taxonomy:
        k = term.lower().strip()
        if " " in k:
            if k in t:
                found.append(term)
        else:
            if k in toks:
                found.append(term)
    # de-dup, keep stable order
    seen = set(); out = []
    for s in found:
        if s.lower() not in seen:
            seen.add(s.lower()); out.append(s)
    return out

# -------- Vectorizer / similarities --------
def build_vectorizer(corpus):
    """
    Strong TF-IDF for resumes/JDs:
    - unigrams + bigrams
    - min_df=3 to cut noise
    - sublinear TF
    """
    vec = TfidfVectorizer(
        ngram_range=(1, 2),
        min_df=3,
        max_features=50000,
        sublinear_tf=True,
        lowercase=True
    )
    vec.fit(corpus)
    return vec

def tfidf_cosine(vec: TfidfVectorizer, a: str, b: str) -> float:
    try:
        va = vec.transform([a])
        vb = vec.transform([b])
        c = cosine_similarity(va, vb)[0, 0]
        if np.isnan(c) or np.isinf(c):
            return 0.0
        return float(c)
    except Exception:
        return 0.0

def idf_overlap(vec: TfidfVectorizer, text_a: str, text_b: str) -> float:
    """Sum of shared terms' idf weights normalized by union idf sum."""
    try:
        v_a = vec.transform([text_a])
        v_b = vec.transform([text_b])
        idx_a = set(v_a.nonzero()[1].tolist())
        idx_b = set(v_b.nonzero()[1].tolist())
        shared = idx_a & idx_b
        if not shared:
            return 0.0
        idf_vals = np.array(vec.idf_)
        num = idf_vals[list(shared)].sum()
        den = idf_vals[list(idx_a | idx_b)].sum() + 1e-9
        x = float(num / den)
        if np.isnan(x) or np.isinf(x):
            return 0.0
        return x
    except Exception:
        return 0.0

# -------- Simple set metrics --------
def jaccard(a: Iterable[str], b: Iterable[str]) -> float:
    A, B = set(a), set(b)
    if not A and not B: return 0.0
    return len(A & B) / float(len(A | B))

# -------- Title/role features --------
def _tok(s: str) -> List[str]:
    return re.findall(r"[a-z0-9+#.\-]+", (s or "").lower())

def title_features(job_title: str, resume_role: str | None) -> Dict[str, float]:
    t = _tok(job_title)
    r = _tok(resume_role or "")
    overlap = len(set(t) & set(r))
    feats = {
        "title_len": float(len(t)),
        "role_len": float(len(r)),
        "title_role_overlap": float(overlap),
        "title_has_ml": 1.0 if any(x in t for x in ["ml","machine","learning","xgboost","pytorch","tensorflow"]) else 0.0,
        "title_has_data": 1.0 if "data" in t else 0.0,
        "title_has_software": 1.0 if any(x in t for x in ["software","developer","engineer"]) else 0.0,
    }
    return feats
