from __future__ import annotations
import os, re, string
from typing import List, Dict, Optional
import numpy as np, pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import joblib
from app.services.llm_client import llm

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
MODELS_DIR = os.path.join(BASE_DIR, "models")
JOBS_CSV = os.path.join(DATA_DIR, "jobs_kaggle.csv")
TFIDF_PKL = os.path.join(MODELS_DIR, "tfidf.pkl")

ROLE_FIELDS = ["title","job_title","role","designation"]
TEXT_FIELDS = ["text","description","desc","job_description","full_text"]

SKILL_LIBRARY = {"generic": ["python","sql","react","fastapi","aws","xgboost","llm","docker","git","flask","django"]}
PUNCT_TABLE = str.maketrans("", "", string.punctuation)

def _clean_text(s:str)->str:
    if not isinstance(s,str): return ""
    s = s.lower().replace("\n"," ")
    s = re.sub(r"\s+"," ",s)
    return s.translate(PUNCT_TABLE).strip()
def _load_jobs():
    if not os.path.exists(JOBS_CSV): raise FileNotFoundError(JOBS_CSV)
    df = pd.read_csv(JOBS_CSV)
    txt_col = next((c for c in df.columns if c.lower() in TEXT_FIELDS), None)
    if not txt_col:
        txt_col = "___combined_text"
        df[txt_col] = df.select_dtypes("object").astype(str).agg(" ".join, axis=1)
    role_col = next((c for c in df.columns if c.lower() in ROLE_FIELDS), None)
    df["_job_text"] = df[txt_col].fillna("").map(_clean_text)
    df["_role"] = df[role_col].fillna("") if role_col else ""
    return df[["_job_text","_role"]].dropna().reset_index(drop=True)

class _FeedbackState:
    def __init__(self):
        self.df_jobs=None; self.vectorizer=None; self.jobs_tfidf=None; self.feature_names=None
STATE=_FeedbackState()

def _load_vectorizer_or_fit(corpus:List[str])->TfidfVectorizer:
    if os.path.exists(TFIDF_PKL):
        return joblib.load(TFIDF_PKL)
    vec=TfidfVectorizer(max_features=50000,ngram_range=(1,2),stop_words="english")
    vec.fit(corpus); return vec

def _ensure_ready():
    if STATE.df_jobs and STATE.vectorizer: return
    df=_load_jobs(); vec=_load_vectorizer_or_fit(df["_job_text"])
    STATE.df_jobs=df; STATE.vectorizer=vec
    STATE.jobs_tfidf=vec.transform(df["_job_text"]); STATE.feature_names=vec.get_feature_names_out().tolist()

def _nearest_jobs(resume_text:str,k:int=25):
    _ensure_ready(); txt=_clean_text(resume_text)
    if len(txt)<10: return np.array([]),np.array([])
    q=STATE.vectorizer.transform([txt])
    sims=cosine_similarity(q,STATE.jobs_tfidf).ravel()
    k=min(k,len(sims)); idx=np.argpartition(-sims,k-1)[:k]; idx=idx[np.argsort(-sims[idx])]
    return idx,sims[idx]
def _extract_present_skills(resume_text:str,extra_vocab:Optional[List[str]]=None)->List[str]:
    txt=" "+_clean_text(resume_text)+" "
    vocab=set(SKILL_LIBRARY["generic"]); 
    if extra_vocab: vocab.update(extra_vocab)
    return sorted([t for t in vocab if " "+t.lower()+" " in txt])

def _top_terms_from_jobs(idx,top_m:int=50)->List[str]:
    if idx.size==0: return []
    sub=STATE.jobs_tfidf[idx]; scores=np.asarray(sub.sum(axis=0)).ravel()
    order=np.argsort(-scores)[:top_m]
    feats=[STATE.feature_names[i] for i in order]
    return [f for f in feats if len(f)>2 and not f.isdigit()]
def _llm_polish_strengths_improvements(resume_text:str,top_terms,list_strengths,list_improvements,target_role=None):
    prompt=f"""
Refine and compact resume feedback.
Target role: {target_role or "N/A"}
Top terms: {", ".join(top_terms[:30])}

Existing strengths:
- {'; '.join(list_strengths) if list_strengths else "(none)"}

Existing improvements:
- {'; '.join(list_improvements) if list_improvements else "(none)"}

Return strict JSON with keys: strengths, improvements.
"""
    import json
    reply=llm.chat(
        [{"role":"system","content":"You refine resumes with concise, actionable guidance."},
         {"role":"user","content":prompt}],
        temperature=0.3)
    try:
        obj=json.loads(reply)
        s=obj.get("strengths",list_strengths) or list_strengths
        i=obj.get("improvements",list_improvements) or list_improvements
        return {"strengths":[str(x).strip() for x in s][:6],
                "improvements":[str(x).strip() for x in i][:6]}
    except Exception:
        return {"strengths":list_strengths[:6],"improvements":list_improvements[:6]}
def rate_resume(resume_text: str, target_role: Optional[str] = None) -> Dict:
    _ensure_ready()
    idx, sims = _nearest_jobs(resume_text, k=25)
    if idx.size == 0:
        return {
            "score": 0,
            "matched_role_samples": [],
            "evidence": {"top_similarities": [], "top_terms": []},
            "strengths": [],
            "improvements": ["Resume text seems very short or empty. Add concrete projects, tools, and outcomes."]
        }

    max_sim = float(sims[0])
    mean_top5 = float(np.mean(sims[:5])) if sims.size >= 5 else float(np.mean(sims))
    raw = 0.7 * max_sim + 0.3 * mean_top5
    score = int(round(100 * raw))

    roles = STATE.df_jobs.iloc[idx]["_role"].fillna("").astype(str).tolist()
    top_terms = _top_terms_from_jobs(idx[:10], top_m=40)

    present = _extract_present_skills(resume_text, extra_vocab=top_terms)
    missing = [t for t in top_terms if t not in [p.lower() for p in present]][:10]

    strengths = []
    if score >= 75:
        strengths.append("Strong alignment with several job postings.")
    if any(x in present for x in ["python", "sql", "react", "fastapi", "xgboost", "llm", "aws"]):
        strengths.append("Good coverage of in-demand tools/tech.")
    if re.search(r"\b(\d+%|\d+\s*(users|clients|requests|records))\b", resume_text, flags=re.I):
        strengths.append("Includes measurable outcomes or scale figures.")

    improvements = []
    if score < 85:
        improvements.append("Add 3–5 role-specific keywords from recent postings (see suggestions).")
    if not re.search(r"\b(projects?|experience|work|internship)\b", resume_text, flags=re.I):
        improvements.append("Add a Projects/Experience section with bullet points.")
    if not re.search(r"\b(led|built|designed|shipped|optimized|deployed)\b", resume_text, flags=re.I):
        improvements.append("Use action verbs to start bullets (led, built, shipped...).")
    if not re.search(r"\b(\d+%|\d+\s*(ms|s|x|users|requests|records))\b", resume_text, flags=re.I):
        improvements.append("Quantify impact (e.g., “reduced latency by 35%”, “served 50k users”).")
    if target_role and target_role.lower() not in " ".join(roles).lower():
        improvements.append(f"Tune your summary toward “{target_role}” with relevant tools and outcomes.")

    if llm.enabled:
        refined = _llm_polish_strengths_improvements(resume_text, top_terms, strengths, improvements, target_role)
        strengths = refined["strengths"]
        improvements = refined["improvements"]

    return {
        "score": max(0, min(100, score)),
        "matched_role_samples": [r for r in roles if r][:5],
        "evidence": {
            "top_similarities": [round(float(s), 4) for s in sims[:10].tolist()],
            "top_terms": top_terms[:25]
        },
        "strengths": strengths[:6],
        "improvements": improvements[:6],
        "present_skills": present[:30],
        "suggested_keywords": missing[:10],
        "llm_used": llm.enabled,
    }


def suggest_missing_skills(resume_text: str, target_role: Optional[str] = None, top_k_jobs: int = 25) -> Dict:
    _ensure_ready()
    idx, _ = _nearest_jobs(resume_text, k=top_k_jobs)
    posting_terms = _top_terms_from_jobs(idx, top_m=80)

    seed = set(SKILL_LIBRARY["generic"])
    if target_role:
        seed.update([w.strip() for w in target_role.lower().split() if len(w.strip()) > 2])

    present = _extract_present_skills(resume_text, extra_vocab=list(seed) + posting_terms)
    normalized_present = set([p.lower() for p in present])

    weighted_posting = posting_terms[:40]
    missing_from_postings = [t for t in weighted_posting if t not in normalized_present]
    missing_seed = [t for t in sorted(seed) if t not in normalized_present]

    combined, seen = [], set()
    for t in missing_from_postings + missing_seed:
        if t not in seen and len(t) > 2 and not t.isdigit():
            combined.append(t)
            seen.add(t)

    if llm.enabled:
        import json
        prompt = f"""
You are an expert career coach. Take the lists below and return JSON with:
- "missing_skills": a prioritized list (max 25) best for the target role
- "grouped": an object grouping skills into 3–6 logical buckets with short titles

Target role: {target_role or "N/A"}

Present skills:
{sorted(list(normalized_present))[:80]}

Candidates from postings (most important first):
{weighted_posting}

Return JSON only: {{"missing_skills": [...], "grouped": {{"Bucket Title": ["skill", ...]}}}}
"""
        reply = llm.chat(
            [{"role": "system", "content": "You create concise, role-aware skill plans."},
             {"role": "user", "content": prompt}],
            temperature=0.2
        )
        try:
            obj = json.loads(reply)
            miss = obj.get("missing_skills", combined) or combined
            grouped = obj.get("grouped", {})
            combined = [str(x).strip() for x in miss][:25]
            return {
                "target_role": target_role or "",
                "present_skills": sorted(list(normalized_present))[:80],
                "missing_skills": combined,
                "grouped": grouped,
                "from_postings": weighted_posting[:40],
                "llm_used": True,
            }
        except Exception:
            pass

    return {
        "target_role": target_role or "",
        "present_skills": sorted(list(normalized_present))[:80],
        "missing_skills": combined[:25],
        "grouped": {},
        "from_postings": weighted_posting[:40],
        "llm_used": False,
    }
