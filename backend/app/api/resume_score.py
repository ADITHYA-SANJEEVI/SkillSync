from typing import Optional, Literal, Dict, Any, List
from fastapi import APIRouter, UploadFile, File, Query, HTTPException
from pydantic import BaseModel
from datetime import datetime
import os, re, io

# ---------- helpers ----------
def _normalize(s:str)->str:
    return re.sub(r"\s+"," ",s.strip().lower())

def _read_txt_bytes(b: bytes) -> str:
    try:
        return b.decode("utf-8", errors="ignore")
    except Exception:
        return b.decode("latin-1", errors="ignore")

def _read_pdf_bytes(b: bytes) -> str:
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(b))
        out=[]
        for page in reader.pages:
            try: t=page.extract_text() or ""
            except: t=""
            if t: out.append(t)
        return "\n".join(out)
    except Exception:
        return ""

def _extract_text_from_upload(file: UploadFile) -> str:
    name=(file.filename or "").lower()
    raw=file.file.read()
    try: file.file.seek(0)
    except: pass
    if name.endswith(".pdf"): text=_read_pdf_bytes(raw)
    elif name.endswith(".txt"): text=_read_txt_bytes(raw)
    else: raise HTTPException(415, "Upload .pdf or .txt only.")
    text=re.sub(r"[ \t]+\n","\n",re.sub(r"\s{2,}"," ",text)).strip()
    if len(text)<80: raise HTTPException(400,"File too short or unreadable.")
    if len(text)>60000: text=text[:60000]+"…[truncated]"
    return text

# ---------- scoring + sections ----------
def _section_score(section:str, weight:int=20)->Dict[str,Any]:
    t=_normalize(section)
    score=weight
    issues=[]
    if len(t)<150: issues.append("Too short; add detail.")
    if "responsibilit" in t or "achieve" in t: score+=10
    if "team" in t or "project" in t: score+=5
    if not re.search(r"\d",t): issues.append("No quantifiable outcomes mentioned.")
    return {"score":max(0,min(score,100)),"issues":issues}

def _split_sections(text:str)->Dict[str,str]:
    keys=["summary","skills","experience","projects","education"]
    segs={}
    for k in keys:
        m=re.search(rf"(?i){k}",text)
        if m:
            segs[k]=text[m.start():][:1500]
    return segs

def _overall_score(parts:Dict[str,Any])->int:
    subs=[p["score"] for p in parts.values() if isinstance(p,dict)]
    return int(sum(subs)/len(subs)) if subs else 50

# ---------- optional LLM ----------
def _llm_available()->bool:
    try:
        import run_llm
        return bool(os.getenv("CHUTES_BASE_URL")) and bool(os.getenv("CHUTES_API_KEY"))
    except Exception:
        return False

def _llm_complete(prompt:str, max_tokens:int=250)->Optional[str]:
    try:
        import run_llm
        return run_llm.complete(prompt=prompt, max_tokens=max_tokens)
    except Exception:
        return None

# ---------- schemas ----------
class ResumeScoreResponse(BaseModel):
    mode: Literal["student","recruiter"]
    feedback: Dict[str,Any]

# ---------- core logic ----------
def _score_resume(text:str, *, mode:str)->Dict[str,Any]:
    sections=_split_sections(text)
    part_scores={}
    for k,v in sections.items():
        part_scores[k]=_section_score(v)
    overall=_overall_score(part_scores)
    feedback={
        "overall_score":overall,
        "sections":part_scores,
        "ats_flags":[],
        "timestamp":datetime.utcnow().isoformat()+"Z",
    }

    if "skills" not in sections: feedback["ats_flags"].append("No clear 'Skills' section found.")
    if "experience" not in sections: feedback["ats_flags"].append("Add 'Experience' with bullet points.")
    if "education" not in sections: feedback["ats_flags"].append("Missing education details.")

    # AI-enhanced rewrite advice
    if _llm_available():
        if mode=="student":
            prompt=(
                "You are an HR reviewer in India. Evaluate this résumé for tone, clarity, and ATS alignment. "
                "List 3 improvements and 2 strengths in bullet points (<25 words each).\n\n"
                f"{text[:12000]}"
            )
            s=_llm_complete(prompt, max_tokens=200)
            if s: feedback["ai_review"]=s
        else:
            prompt=(
                "Summarize this résumé for a recruiter: one line headline and top 5 hire signals "
                "(skills, companies, degrees, certifications).\n\n"
                f"{text[:12000]}"
            )
            s=_llm_complete(prompt, max_tokens=120)
            if s: feedback["recruiter_summary"]=s

    return feedback

# ---------- unified endpoint ----------
router = APIRouter()

@router.post("/api/v1/llm/feedback/resume-score",
             response_model=ResumeScoreResponse,
             summary="Score résumé (Student/Recruiter – file-only)")
async def resume_score(
    mode: Literal["student","recruiter"]=Query(...,description="Choose output mode"),
    file: UploadFile=File(...,description="Résumé file (.pdf or .txt)")
):
    """
    ONE endpoint:
    - Student → résumé readability + ATS scoring + LLM review
    - Recruiter → quick fit summary + headline signals
    File-only; no text input.
    """
    text=_extract_text_from_upload(file)
    fb=_score_resume(text,mode=mode)
    return {"mode":mode,"feedback":fb}

def install(app):
    """Remove any existing POST /api/v1/llm/feedback/resume-score and mount this unified version."""
    keep=[]
    for r in app.router.routes:
        try:
            if r.path=="/api/v1/llm/feedback/resume-score" and "POST" in getattr(r,"methods",[]):
                continue
        except: pass
        keep.append(r)
    app.router.routes=keep
    app.include_router(router)
