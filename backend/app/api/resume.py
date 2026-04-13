# backend/app/api/resume.py
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
from datetime import datetime
import re, uuid

from app.services.file_read import read_upload_text_with_bytes

router = APIRouter()

UPLOAD_DIR = Path(__file__).resolve().parents[1].parent / "uploads" / "resumes"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

def _safe(name: str) -> str:
    # simple slug
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", name or "upload")
    return base.strip("._") or "upload"

class UploadResponse(BaseModel):
    filename: str
    source: str            # 'pdf' | 'txt' | 'inline'
    size: int
    preview: str
    saved_original: Optional[str] = None   # relative path
    saved_text: Optional[str] = None       # relative path

@router.post(
    "/upload-resume",
    response_model=UploadResponse,
    summary="Upload Resume (.txt/.pdf) or send inline text — saves to backend/uploads/resumes/",
)
async def upload_resume(
    file: UploadFile | None = File(None),
    text: Optional[str] = Form(None),
):
    # inline text path (no file to save)
    if not file and text:
        content = (text or "").strip()
        rel_txt = None
        return UploadResponse(
            filename="inline.txt",
            source="inline",
            size=len(content.encode("utf-8", errors="ignore")),
            preview=content[:1200],
            saved_original=None,
            saved_text=rel_txt,
        )

    if not file:
        raise HTTPException(status_code=400, detail="Send a file or 'text'.")

    # read + detect + get raw bytes
    content, kind, raw = await read_upload_text_with_bytes(file)

    # persist: original + normalized text
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    stem = f"{ts}_{uuid.uuid4().hex[:8]}_{_safe(file.filename or kind)}"
    orig_path = UPLOAD_DIR / stem
    text_path = UPLOAD_DIR / f"{stem}.txt"

    # choose extension for original
    if kind == "pdf" and not str(orig_path).lower().endswith(".pdf"):
        orig_path = orig_path.with_suffix(".pdf")
    elif kind == "txt" and not str(orig_path).lower().endswith(".txt"):
        orig_path = orig_path.with_suffix(".txt")

    orig_path.write_bytes(raw)
    text_path.write_text(content or "", encoding="utf-8")

    rel_orig = str(orig_path.relative_to(UPLOAD_DIR.parents[0]))
    rel_text = str(text_path.relative_to(UPLOAD_DIR.parents[0]))

    return UploadResponse(
        filename=file.filename or "",
        source=kind,
        size=len(raw),
        preview=(content or "")[:1200],
        saved_original=rel_orig.replace("\\", "/"),
        saved_text=rel_text.replace("\\", "/"),
    )
