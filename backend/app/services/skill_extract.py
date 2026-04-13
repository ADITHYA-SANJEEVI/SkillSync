from __future__ import annotations
import json
from pathlib import Path
from typing import List
from rapidfuzz import process, fuzz

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
TAX = DATA_DIR / "skills_taxonomy.json"

if TAX.exists():
    TAXONOMY: List[str] = json.loads(TAX.read_text(encoding="utf-8"))
else:
    TAXONOMY = ["python","pandas","numpy","sql","scikit-learn","xgboost","tensorflow","pytorch","docker","aws","kubernetes","airflow","mlflow","spark","nlp","computer vision","linux","git","gcp","azure"]

def extract_skills(text: str, threshold: int = 90) -> List[str]:
    if not text: return []
    tlow = text.lower()
    found = set()
    for s in TAXONOMY:
        score = process.extractOne(s, [tlow], scorer=fuzz.partial_ratio)[1]
        if score >= threshold:
            found.add(s.lower())
    return sorted(found)
