# app/services/payloads.py
from __future__ import annotations
from typing import Optional, Tuple
from fastapi import UploadFile
import io

def _read_txt(b: bytes) -> str:
    return b.decode("utf-8", errors="ignore")

def _read_pdf(b: bytes) -> str:
    try:
        from pdfminer.high_level import extract_text
        return extract_text(io.BytesIO(b))
    except Exception:
        # Fallback tiny parser to avoid hard dependency issues
        try:
            import PyPDF2
            reader = PyPDF2.PdfReader(io.BytesIO(b))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            return ""

def bytes_to_text(filename: str, content: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        return _read_pdf(content)
    return _read_txt(content)

async def get_text_from_inputs(
    *,
    inline_text: Optional[str],
    file: Optional[UploadFile],
) -> Tuple[str, dict]:
    """
    Returns (text, meta) from either inline string or uploaded file.
    meta = {"source":"inline"|"file","filename":str|None,"length":int}
    """
    if inline_text and inline_text.strip():
        text = inline_text.strip()
        return text, {"source": "inline", "filename": None, "length": len(text)}

    if file:
        raw = await file.read()
        text = bytes_to_text(file.filename, raw)
        return text, {"source": "file", "filename": file.filename, "length": len(text)}

    return "", {"source": "none", "filename": None, "length": 0}
