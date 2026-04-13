# backend/app/services/file_read.py
from __future__ import annotations
from typing import Tuple
from fastapi import UploadFile
import io, re

def _clean(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()

def _pdf_text(data: bytes) -> str:
    # Try PyPDF2, then pdfminer.six
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(io.BytesIO(data))
        return _clean("\n".join(page.extract_text() or "" for page in reader.pages))
    except Exception:
        pass
    try:
        from pdfminer.high_level import extract_text
        return _clean(extract_text(io.BytesIO(data)))
    except Exception:
        return ""

async def read_upload_text(file: UploadFile) -> tuple[str, str]:
    """Return (text, kind) for compatibility ('pdf' or 'txt')."""
    txt, kind, _ = await read_upload_text_with_bytes(file)
    return txt, kind

async def read_upload_text_with_bytes(file: UploadFile) -> tuple[str, str, bytes]:
    """
    Returns (text, detected_type, raw_bytes).
    detected_type is 'pdf' or 'txt'.
    """
    data = await file.read()
    name = (file.filename or "").lower()
    ctype = (file.content_type or "").lower()

    is_pdf = name.endswith(".pdf") or "pdf" in ctype
    if is_pdf:
        txt = _pdf_text(data) or _clean(data.decode("utf-8", errors="ignore"))
        return txt, "pdf", data

    # default: treat as text
    txt = _clean(data.decode("utf-8", errors="ignore"))
    return txt, "txt", data
