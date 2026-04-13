from typing import List, Optional, Literal, Dict, Any
from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from datetime import datetime
import os, re, io

# -------- utils --------
def _normalize(s: str) -> str:
    return re.sub(r"\s+"," ", s.strip().lower())

def _squash_ws(s: str) -> str:
    return re.sub(r"[ \t]+\n", "\n", re.sub(r"\s{2,}", " ", s)).strip()

def _read_txt_bytes(b: bytes) -> str:
    try:
        return b.decode("utf-8", errors="ignore")
    except Exception:
        return b.decode("latin-1", errors="ignore")

def _read_pdf_bytes(b: bytes) -> str:
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(b))
        chunks = []
        for page in reader.pages:
            try:
                t = page.extract_text() or ""
            except Exception:
                t = ""
            if t:
                chunks.append(t)
        return "\n".join(chunks)
    except Exception:
        return ""

def _extract_text_from_upload(file: UploadFile) -> str:
    name = (file.filename or "").lower()
    ctype = (file.content_type or "").lower()
    raw = file.file.read()
    try:
        file.file.seek(0)
    except Exception:
        pass
    if name.endswith(".txt") or "text/plain" in ctype:
        text = _read_txt_bytes(raw)
    elif name.endswith(".pdf") or "pdf" in ctype:
        text = _read_pdf_bytes(raw)
        if not text:
            raise HTTPException(status_code=415, detail="PDF text extraction failed; upload a selectable-text PDF.")
    else:
        raise HTTPException(status_code=415, detail="Unsupported file type. Please upload .pdf or .txt")
    text = _squash_ws(text)
    if len(text) > 60000:
        text = text[:60000] + "\n…[truncated]"
    return text

# ---- simple NLP to get a usable profile (works w/o LLM) ----
_SOFT = {"communication","leadership","teamwork","ownership","problem solving","time management","mentorship"}
_HARD_HINTS = {"python","java","sql","excel","react","typescript","next.js","fastapi","flask","django","pandas","numpy","power bi","tableau","docker","kubernetes","git","aws","gcp","azure"}

def _extract_skills(text:str):
    t=_normalize(text)
    hard=set()
    for h in _HARD_HINTS:
        if h in t:
            hard.add(h)
    soft=set(s for s in _SOFT if s in t)
    tools=[s for s in hard if s not in {"python","java","sql","excel","react","typescript"}]
    return {
        "hard": sorted(hard),
        "soft": sorted(soft),
        "tools": sorted(tools),
    }

def _guess_name(text:str)->Optional[str]:
    m=re.search(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b", text)
    return m.group(1) if m else None

def _extract_sections(text:str)->Dict[str,str]:
    t = text
    def cut(keywords):
        for kw in keywords:
            m=re.search(rf"\n?\s*{kw}\s*[:\-]?\s*\n", t, flags=re.I)
            if m: return m.start()
        return None
    keys = {
        "summary": cut(["summary","objective","profile"]),
        "experience": cut(["experience","work experience","employment"]),
        "education": cut(["education","academics"]),
        "projects": cut(["projects","personal projects"]),
        "skills": cut(["skills","technical skills"]),
    }
    # naive segmentation by nearest next header
    order=[k for k,v in keys.items() if v is not None]
    order.sort(key=lambda k: keys[k])
    out={}
    for i,k in enumerate(order):
        start=keys[k]; end = len(t) if i==len(order)-1 else keys[order[i+1]]
        out[k]=t[start:end].strip()
    return out

def _summarize_experience(text:str)->List[Dict[str,Any]]:
    lines=[ln for ln in text.splitlines() if ln.strip()]
    bullets=[]
    for ln in lines[:12]:
        bullets.append({"bullet": ln.strip()})
    return bullets

# ------------- optional LLM -------------
def _llm_available()->bool:
    try:
        import run_llm
        return bool(os.getenv("CHUTES_BASE_URL")) and bool(os.getenv("CHUTES_API_KEY"))
    except Exception:
        return False

def _llm_complete(prompt:str, max_tokens:int=300)->Optional[str]:
    try:
        import run_llm
        return run_llm.complete(prompt=prompt, max_tokens=max_tokens)
    except Exception:
        return None

# ---------- schema ----------
class UploadResumeResponse(BaseModel):
    mode: Literal["student","recruiter"]
    profile: Dict[str, Any]

# ---------- core builders ----------
def _build_profile(text:str, *, mode:str, location:Optional[str])->Dict[str,Any]:
    name=_guess_name(text)
    sections=_extract_sections(text)
    skills=_extract_skills(text)
    exp_section = sections.get("experience","")
    projects_section = sections.get("projects","")
    education_section = sections.get("education","")

    profile = {
        "name": name,
        "summary": sections.get("summary","").strip()[:1000] or None,
        "skills": skills,
        "experience_bullets": _summarize_experience(exp_section),
        "projects_excerpt": projects_section[:1500] or None,
        "education_excerpt": education_section[:800] or None,
        "location_hint": location,
        "extracted_at": datetime.utcnow().isoformat()+"Z",
    }

    if _llm_available():
        # student summary
        if mode=="student":
            region = location or "India"
            prompt = (
                "You are an employability coach in India. "
                "Write a crisp 3-bullet professional summary (<40 words each) from this résumé text. "
                "Each bullet should mention impact, tools, and scope. Avoid fluff.\n\n"
                f"RESUME TEXT:\n{text[:12000]}"
            )
            s = _llm_complete(prompt, max_tokens=220)
            if s: profile["llm_summary"]=s
        # recruiter tags
        else:
            prompt = (
                "Extract normalized tags for recruiting from this résumé text. "
                "Return 1 line with comma-separated tags (skills, titles, seniority, domains). "
                "No commentary.\n\n"
                f"{text[:12000]}"
            )
            t = _llm_complete(prompt, max_tokens=80)
            if t: profile["recruiter_tags"]=t

    return profile

# -------------- single unified endpoint (file-only) --------------
router = APIRouter()

@router.post("/api/v1/llm/upload-resume", response_model=UploadResumeResponse, summary="Upload résumé (Student/Recruiter – file-only)")
async def upload_resume(
    mode: Literal["student","recruiter"] = Query(..., description="Choose output mode"),
    file: UploadFile = File(..., description="Résumé file (.pdf or .txt)"),
    location: Optional[str] = Query(None, description="Optional city/region to tailor summaries")
):
    """
    ONE endpoint:
    - Student → returns parsed profile + AI summary tailored to India.
    - Recruiter → returns parsed profile + recruiting tags (LLM if available).
    Input is file-only (.pdf/.txt). No text fields.
    """
    text = _extract_text_from_upload(file)
    if not text or len(text) < 20:
        raise HTTPException(status_code=400, detail="No readable text found in file.")
    profile = _build_profile(text, mode=mode, location=location)
    return {"mode": mode, "profile": profile}

def install(app):
    """Remove any existing POST /api/v1/llm/upload-resume, then mount this unified endpoint."""
    to_keep = []
    for r in app.router.routes:
        try:
            path = getattr(r, "path", None)
            methods = getattr(r, "methods", set())
            if path == "/api/v1/llm/upload-resume" and "POST" in methods:
                continue
        except Exception:
            pass
        to_keep.append(r)
    app.router.routes = to_keep
    app.include_router(router)
