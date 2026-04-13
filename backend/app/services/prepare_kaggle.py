# backend/app/services/prepare_kaggle.py  (STRICT CSE FILTER)
from __future__ import annotations
import argparse, re
from pathlib import Path
import pandas as pd

# Whitelist: resume dataset labels that are clearly CSE-ish
CSE_RESUME_WHITELIST = {
    "Data Science","Information Technology","Java Developer","Python Developer","Web Designing",
    "Database","DevOps Engineer","Software Developer","Software Engineer","Android Developer",
    "Testing","Blockchain","Hadoop","ETL Developer","Cloud","Network Security","UI Developer",
    "Big Data","Data Analyst","DotNet Developer",".NET Developer","C++ Developer","C# Developer",
    "iOS Developer","Frontend Developer","Backend Developer","Full Stack","System Administrator",
    "AI","Machine Learning","Deep Learning","MLOps","Data Engineer"
}

# Blacklist: common non-CSE labels to exclude even if keywords match
NON_CSE_BLACKLIST = {
    "HR","Human Resources","Advocate","Arts","Operations Manager","Sales","Health and fitness",
    "Civil Engineer","Electrical Engineering","Mechanical Engineer","Automobile","Legal","Finance",
    "Accounting","Designer","Interior Designer","Public Relations","Business Analyst","Chef",
    "Teacher","BPO","Consultant","Dentist","Fitness","Banking","Chartered Accountant"
}

# Keyword gates for resume TEXT (must pass these too)
TECH_TOKENS = {
    "python","java","c++","c#","golang","go","javascript","typescript","node","react",".net",
    "sql","mysql","postgres","mongodb","docker","kubernetes","aws","gcp","azure",
    "linux","git","spark","hadoop","airflow","kafka","ml","machine learning","deep learning",
    "xgboost","pytorch","tensorflow","scikit-learn","nlp","computer vision","devops","mlops",
    "api","microservices","rest","graphql","flask","fastapi","django"
}
CORE_LANGS = {"python","java","c++","c#","golang","go","javascript","typescript","sql","react",".net"}

def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+","_", (s or "").lower()).strip("_")

def canon_cols(df: pd.DataFrame) -> dict:
    """Map canonical -> actual col names by heuristics."""
    norm = {c:_slug(c) for c in df.columns}
    inv  = {v:k for k,v in norm.items()}
    m = {}
    for k in ["resume","resume_str","text","resume_text","resumes","summary"]:
        if k in inv: m["resume_text"] = inv[k]; break
    for k in ["category","label","role","job_category","profession"]:
        if k in inv: m["category"] = inv[k]; break
    for k in ["job_title","title","position"]:
        if k in inv: m["job_title"] = inv[k]; break
    for k in ["job_text","job_description","description","job_desc","desc"]:
        if k in inv: m["job_text"] = inv[k]; break
    return m

def tech_score(text: str) -> int:
    t = (text or "").lower()
    return sum(1 for k in TECH_TOKENS if k in t)

def has_core_lang(text: str) -> bool:
    t = (text or "").lower()
    return any(k in t for k in CORE_LANGS)

def is_non_cse_category(cat: str) -> bool:
    if not cat: return False
    c = cat.strip().lower()
    return any(c == x.lower() for x in NON_CSE_BLACKLIST)

def is_cse_category(cat: str) -> bool:
    if not cat: return False
    c = cat.strip().lower()
    return any(c == x.lower() for x in CSE_RESUME_WHITELIST)

def prepare(resume_csv: Path, jobs_csv: Path, outdir: Path,
            cse_only: bool = True, max_resumes: int | None = None, max_jobs: int | None = None):
    outdir = Path(outdir); outdir.mkdir(parents=True, exist_ok=True)

    # ----- Resumes -----
    r = pd.read_csv(resume_csv)
    mr = canon_cols(r)
    if "resume_text" not in mr:
        raise SystemExit(f"Resume file missing text column. Columns={list(r.columns)}")
    if "category" not in mr:
        r["Category"] = "Unknown"; mr["category"] = "Category"

    resumes = r[[mr["category"], mr["resume_text"]]].rename(
        columns={mr["category"]: "category", mr["resume_text"]: "resume_text"}
    ).astype({"category":"string","resume_text":"string"})

    if cse_only:
        # 1) Drop explicit non-CSE categories
        before = len(resumes)
        resumes = resumes[~resumes["category"].map(is_non_cse_category)]
        after1 = len(resumes)

        # 2) Keep only if (whitelist category) OR (tech_score>=3 AND has_core_lang)
        mask = resumes["category"].map(is_cse_category) | (
            resumes["resume_text"].map(tech_score).ge(3) & resumes["resume_text"].map(has_core_lang)
        )
        resumes = resumes[mask]
        after2 = len(resumes)

        print(f"[prepare] resumes filtered: start={before} -> no-nonCSE={after1} -> tech-gated={after2}")

        # 3) If still too few, relax a bit but never include blacklist
        if after2 == 0:
            print("[prepare] WARN: strict CSE filter yielded 0 resumes; falling back to keyword gate only.")
            resumes = r[[mr["category"], mr["resume_text"]]].rename(
                columns={mr["category"]: "category", mr["resume_text"]: "resume_text"}
            )
            resumes = resumes[~resumes["category"].map(is_non_cse_category)]
            resumes = resumes[resumes["resume_text"].map(tech_score).ge(4)]
            resumes = resumes[resumes["resume_text"].map(has_core_lang)]

    if max_resumes:
        resumes = resumes.sample(n=min(max_resumes, len(resumes)), random_state=42)

    print(f"[prepare] resumes: {len(resumes)} rows")

    # ----- Jobs -----
    j = pd.read_csv(jobs_csv)
    mj = canon_cols(j)
    if "job_title" not in mj or "job_text" not in mj:
        raise SystemExit(f"Jobs file must have title+description. Columns={list(j.columns)}")

    jobs = j[[mj["job_title"], mj["job_text"]]].rename(
        columns={mj["job_title"]: "job_title", mj["job_text"]: "job_text"}
    ).astype({"job_title":"string","job_text":"string"})

    # Your jobs file is already CSE, so no filter necessary; but we can keep a light gate:
    jobs = jobs[jobs["job_title"].str.len().gt(0) & jobs["job_text"].str.len().gt(0)]

    if max_jobs:
        jobs = jobs.sample(n=min(max_jobs, len(jobs)), random_state=42)

    print(f"[prepare] jobs: {len(jobs)} rows")

    # Write outputs the trainer expects
    (outdir / "resumes_kaggle.csv").write_text(resumes.to_csv(index=False), encoding="utf-8")
    (outdir / "jobs_kaggle.csv").write_text(jobs.to_csv(index=False), encoding="utf-8")
    print(f"[prepare] wrote: {outdir/'resumes_kaggle.csv'}")
    print(f"[prepare] wrote: {outdir/'jobs_kaggle.csv'}")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--resume", required=True)
    p.add_argument("--jobs",   required=True)
    p.add_argument("--outdir", default=str(Path(__file__).resolve().parents[1] / "data"))
    p.add_argument("--all", action="store_true", help="Do NOT filter to CSE-only")
    p.add_argument("--max_resumes", type=int, default=None)
    p.add_argument("--max_jobs", type=int, default=None)
    args = p.parse_args()
    prepare(Path(args.resume), Path(args.jobs), Path(args.outdir),
            cse_only=(not args.all),
            max_resumes=args.max_resumes, max_jobs=args.max_jobs)
