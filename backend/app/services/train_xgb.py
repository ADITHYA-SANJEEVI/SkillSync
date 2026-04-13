# backend/app/services/train_xgb.py
from __future__ import annotations
import sys, random
from pathlib import Path
import numpy as np
import pandas as pd
import joblib
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

from app.services.features import (
    normalize_text, extract_skills, load_taxonomy, build_vectorizer,
    tfidf_cosine, jaccard, title_features, idf_overlap
)

# ---------- Paths ----------
BASE   = Path(__file__).resolve().parents[1]
DATA   = BASE / "data"
MODELS = BASE / "models"
MODELS.mkdir(parents=True, exist_ok=True)

RESUME_CSV = DATA / "resumes_kaggle.csv"
JOB_CSV    = DATA / "jobs_kaggle.csv"
MODEL_JSON = MODELS / "xgb_fit_model.json"
VEC_PKL    = MODELS / "tfidf.pkl"

def log(msg: str): print(msg, flush=True)

# ---------- Flexible readers (accept many schema variants) ----------
def _pick_col(df: pd.DataFrame, candidates: list[str], req_name: str) -> str:
    norm = {c.lower().strip(): c for c in df.columns}
    for cand in candidates:
        k = cand.lower().strip()
        if k in norm:
            return norm[k]
    raise ValueError(f"{req_name} column not found. Have: {list(df.columns)}")

def read_resumes(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    text_col = _pick_col(df, ["resume_text","Resume","Resume_str","Text","resume"], "resume text")
    try:
        label_col = _pick_col(df, ["category","Category","label","role","job_category","profession"], "category")
    except ValueError:
        df["Category"] = "Unknown"; label_col = "Category"
    out = df[[label_col, text_col]].rename(columns={label_col: "Category", text_col: "Resume"})
    out["Category"] = out["Category"].astype(str)
    out["Resume"]   = out["Resume"].astype(str)
    return out

def read_jobs(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    title_col = _pick_col(df, ["job_title","title","position"], "job title")
    desc_col  = _pick_col(df, ["job_text","job_description","description","job_desc","desc"], "job description")
    out = df[[title_col, desc_col]].rename(columns={title_col: "Title", desc_col: "Description"})
    out["Title"]       = out["Title"].astype(str)
    out["Description"] = out["Description"].astype(str)
    return out

# ---------- Retrieval-labelled pairs (positives = top TF-IDF, negatives = bottom) ----------
def make_pairs_by_retrieval(
    resumes: pd.DataFrame,
    jobs: pd.DataFrame,
    vec,
    pos_per_job: int = 3,
    neg_per_job: int = 8,
    top_pos_k: int = 5,
    neg_pool_from_bottom: int = 500,
    seed: int = 42,
) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    # normalize texts
    R_texts = resumes["Resume"].map(normalize_text).tolist()
    J_texts = jobs["Description"].map(normalize_text).tolist()

    # cache vectors
    log("[pairs] vectorizing resumes and jobs …")
    R_mat = vec.transform(R_texts)    # (#R x V)
    J_mat = vec.transform(J_texts)    # (#J x V)

    # L2-normalize rows so dot == cosine
    def l2_row_norm(m):
        denom = np.sqrt((m.multiply(m)).sum(axis=1)).A1 + 1e-12
        return m.multiply((1.0 / denom)[:, None])

    Rn = l2_row_norm(R_mat).tocsr()
    Jn = l2_row_norm(J_mat).tocsr()

    log("[pairs] computing cosine matrix J x R …")
    COS = Jn @ Rn.T  # (J x R) sparse

    rows = []
    num_R = Rn.shape[0]
    for j_idx in range(Jn.shape[0]):
        sims_row = COS.getrow(j_idx).toarray().ravel()
        order = np.argsort(-sims_row)  # desc
        # Positives = top_k; sample pos_per_job from them
        pos_cand = order[:min(top_pos_k, num_R)]
        if pos_cand.size == 0:
            continue
        pos_pick = rng.choice(pos_cand, size=min(pos_per_job, len(pos_cand)), replace=False)

        # Hard negatives from bottom tail
        tail = order[::-1][:min(neg_pool_from_bottom, num_R)]
        if tail.size == 0:
            continue
        neg_pick = rng.choice(tail, size=min(neg_per_job, len(tail)), replace=False)

        for r_idx in pos_pick:
            rows.append({
                "resume_text": resumes.iloc[r_idx]["Resume"],
                "resume_role": resumes.iloc[r_idx]["Category"],
                "job_title":   jobs.iloc[j_idx]["Title"],
                "job_text":    jobs.iloc[j_idx]["Description"],
                "label": 1
            })
        for r_idx in neg_pick:
            rows.append({
                "resume_text": resumes.iloc[r_idx]["Resume"],
                "resume_role": resumes.iloc[r_idx]["Category"],
                "job_title":   jobs.iloc[j_idx]["Title"],
                "job_text":    jobs.iloc[j_idx]["Description"],
                "label": 0
            })

    return pd.DataFrame(rows)

# ---------- Feature builder ----------
def compute_features(df: pd.DataFrame, vec) -> pd.DataFrame:
    tax = load_taxonomy()
    feats = []
    for _, row in df.iterrows():
        rtext = normalize_text(row["resume_text"])
        jtext = normalize_text(row["job_text"])
        rskills = extract_skills(rtext, tax)
        jskills = extract_skills(jtext, tax)
        overlap = len(set(rskills) & set(jskills))
        union   = len(set(rskills) | set(jskills))
        feats.append({
            "cosine":            tfidf_cosine(vec, rtext, jtext),
            "idf_overlap":       idf_overlap(vec, rtext, jtext),
            "skill_overlap":     float(overlap),
            "skill_union":       float(union),
            "skill_jaccard":     jaccard(rskills, jskills),
            "resume_skill_count": float(len(rskills)),
            "job_skill_count":    float(len(jskills)),
            **title_features(row.get("job_title",""), row.get("resume_role","")),
        })
    F = pd.DataFrame(feats).replace([np.inf, -np.inf], 0.0).fillna(0.0)
    return F

    # ---------- Train ----------
    def train_main():
        random.seed(42); np.random.seed(42)

        log(f"[train] resumes CSV: {RESUME_CSV}  exists={RESUME_CSV.exists()}")
        log(f"[train] jobs    CSV: {JOB_CSV}    exists={JOB_CSV.exists()}")

        resumes = read_resumes(RESUME_CSV)
        jobs    = read_jobs(JOB_CSV)
        log(f"[train] loaded resumes: {resumes.shape}, jobs: {jobs.shape}")

        # Shuffle/subset (tune as needed)
        resumes = resumes.sample(frac=1.0, random_state=42).head(4000)
        jobs    = jobs.sample(frac=1.0, random_state=42).head(1500)
        log(f"[train] subset resumes: {resumes.shape}, jobs: {jobs.shape}")

        # Vectorizer corpus
        corpus = pd.concat([resumes["Resume"], jobs["Description"]], axis=0).tolist()
        log(f"[train] building TF-IDF on corpus of {len(corpus)} docs …")
        vec = build_vectorizer(corpus)

        # Retrieval-based pairs
        pairs = make_pairs_by_retrieval(
            resumes, jobs, vec,
            pos_per_job=3, neg_per_job=8,
            top_pos_k=5, neg_pool_from_bottom=500, seed=42
        )
        log(f"[train] built pairs: {pairs.shape}")

        if pairs.empty:
            raise SystemExit("[train] ERROR: No training pairs generated.")

    # Features
    X = compute_features(pairs, vec).values
    y = pairs["label"].values.astype(np.int32)
    log(f"[train] features: X={X.shape}, y={y.shape}, positives={int(y.sum())}, negatives={len(y)-int(y.sum())}")

    # Train/valid
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    log("[train] training XGBoost (hist) …")
    clf = xgb.XGBClassifier(
        n_estimators=700, max_depth=7, learning_rate=0.05,
        subsample=0.9, colsample_bytree=0.8,
        eval_metric="auc", tree_method="hist", n_jobs=4, random_state=42
    )
    clf.fit(X_tr, y_tr, eval_set=[(X_te, y_te)], verbose=False)
    pred = clf.predict_proba(X_te)[:, 1]
    auc  = roc_auc_score(y_te, pred)
    log(f"[train] AUC={auc:.3f} on holdout (n={len(y_te)})")

    # Save artifacts
    clf.get_booster().save_model(str(MODEL_JSON))
    joblib.dump(vec, VEC_PKL)
    log(f"[train] saved model: {MODEL_JSON}")
    log(f"[train] saved vectorizer: {VEC_PKL}")
    log("[train] done.")

if __name__ == "__main__":
    try:
        train_main()
    except Exception as e:
        print(f"[train] FATAL: {e}", file=sys.stderr)
        raise
