# app/ml/file_extractors.py
from typing import Optional
from fastapi import UploadFile

def _safe_decode(data: bytes) -> str:
    try:
        return data.decode("utf-8", errors="ignore")
    except Exception:
        return data.decode("latin-1", errors="ignore")

async def _read_file_bytes(file: UploadFile) -> bytes:
    # reset pointer if re-used
    try:
        await file.seek(0)
    except Exception:
        pass
    data = await file.read()
    # best-effort reset for next readers
    try:
        await file.seek(0)
    except Exception:
        pass
    return data

def _is_pdf(file: UploadFile) -> bool:
    name = (file.filename or "").lower()
    ct = (file.content_type or "").lower()
    return name.endswith(".pdf") or "pdf" in ct

def _is_docx(file: UploadFile) -> bool:
    name = (file.filename or "").lower()
    ct = (file.content_type or "").lower()
    return name.endswith(".docx") or "officedocument.wordprocessingml.document" in ct

async def _pdf_to_text(data: bytes) -> str:
    # Try pypdf if available
    try:
        from pypdf import PdfReader  # pip install pypdf
        import io
        reader = PdfReader(io.BytesIO(data))
        parts = []
        for page in reader.pages:
            try:
                parts.append(page.extract_text() or "")
            except Exception:
                continue
        text = "\n".join(parts).strip()
        return text
    except Exception:
        # Fallback to byte-decode (may be messy but never crashes)
        return _safe_decode(data)

async def _docx_to_text(data: bytes) -> str:
    # Try docx2txt if available
    try:
        import docx2txt  # pip install docx2txt
        import tempfile, os
        with tempfile.TemporaryDirectory() as td:
            tmp = os.path.join(td, "tmp.docx")
            with open(tmp, "wb") as f:
                f.write(data)
            text = docx2txt.process(tmp) or ""
            return text.strip()
    except Exception:
        return _safe_decode(data)

async def extract_text_from_resume_file(
    resume_file: Optional[UploadFile],
    resume_text: Optional[str],
) -> str:
    if resume_text and resume_text.strip():
        return resume_text.strip()
    if resume_file is not None:
        data = await _read_file_bytes(resume_file)
        if _is_pdf(resume_file):
            return await _pdf_to_text(data)
        if _is_docx(resume_file):
            return await _docx_to_text(data)
        return _safe_decode(data).strip()
    return ""

async def extract_text_from_job_file_or_text(
    jobs_file: Optional[UploadFile],
    jobs_text: Optional[str],
) -> str:
    if jobs_text and jobs_text.strip():
        return jobs_text.strip()
    if jobs_file is not None:
        data = await _read_file_bytes(jobs_file)
        if _is_pdf(jobs_file):
            return await _pdf_to_text(data)
        if _is_docx(jobs_file):
            return await _docx_to_text(data)
        return _safe_decode(data).strip()
    return ""
