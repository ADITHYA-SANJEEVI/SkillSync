# backend/app/api/feedback.py
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import json
from app.services.file_read import read_upload_text

router = APIRouter()

@router.get("/feedback/ping", summary="Feedback Ping")
def ping():
    return {"ok": True}

@router.post("/feedback/resume-score", summary="Resume score (.txt/.pdf or text)")
async def resume_score(
    file: UploadFile | None = File(None),
    text: Optional[str] = Form(None),
    skills: Optional[str] = Form(None),   # send as JSON string: '["python","sql"]'
    years_exp: Optional[float] = Form(0.0),
):
    if file:
        content, _ = await read_upload_text(file)
    else:
        if not text:
            raise HTTPException(status_code=400, detail="Send a file or 'text'.")
        content = text

    try:
        skill_list: List[str] = json.loads(skills) if skills else []
        if not isinstance(skill_list, list): skill_list = []
    except Exception:
        skill_list = []

    base = 50
    base += min(20, len(set(s.lower() for s in skill_list)) * 3)
    base += min(20, int(years_exp or 0) * 2)
    base += 10 if "python" in content.lower() else 0
    return {"score": min(100, base)}
