# backend/app/services/model_xgb.py
from __future__ import annotations
from pathlib import Path
import joblib, xgboost as xgb
import numpy as np
from typing import Dict
from app.services.features import normalize_text, extract_skills, load_taxonomy, tfidf_cosine, title_features

BASE = Path(__file__).resolve().parents[1]
MODELS = BASE / "models"
MODEL_JSON = MODELS / "xgb_fit_model.json"
VEC_PKL    = MODELS / "tfidf.pkl"

# Lazy globals
_booster = None
_vec = None
_tax = None

def _ensure_loaded():
    global _booster, _vec, _tax
    if _booster is None:
        bst = xgb.Booster()
        bst.load_model(str(MODEL_JSON))
        _booster = bst
    if _vec is None:
        _vec = joblib.load(VEC_PKL)
    if _tax is None:
        _tax = load_taxonomy()

def _featurize(resume_text: str, job_title: str, job_text: str) -> np.ndarray:
    r = normalize_text(resume_text or "")
    j = normalize_text(job_text or "")
    rskills = extract_skills(r, _tax)
    jskills = extract_skills(j, _tax)
    overlap = len(set(rskills) & set(jskills))
    union   = len(set(rskills) | set(jskills))
    jac     = 0.0 if union == 0 else overlap / float(union)
    cos     = tfidf_cosine(_vec, r, j)
    tfeat   = title_features(job_title or "", "")

    feats: Dict[str, float] = {
        "cosine": cos,
        "skill_overlap": overlap,
        "skill_union": union,
        "skill_jaccard": jac,
        "resume_skill_count": len(rskills),
        "job_skill_count": len(jskills),
        **tfeat
    }
    # fixed order
    keys = ["cosine","skill_overlap","skill_union","skill_jaccard",
            "resume_skill_count","job_skill_count",
            "title_data_science","role_data_science","title_data_analyst","role_data_analyst",
            "title_ml","role_ml","title_swe","role_swe","title_role_match"]
    x = np.array([feats.get(k, 0.0) for k in keys], dtype=np.float32).reshape(1,-1)
    return x

def score_pair(resume_text: str, job_title: str, job_text: str) -> float:
    _ensure_loaded()
    x = _featurize(resume_text, job_title, job_text)
    d = xgb.DMatrix(x)
    p = float(_booster.predict(d)[0])
    return p
