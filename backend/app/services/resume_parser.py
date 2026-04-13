from typing import Tuple
from fastapi import UploadFile
from PyPDF2 import PdfReader
from pdfminer.high_level import extract_text as pdfminer_extract
from docx import Document
import re, io

def _read_pdf_pypdf(data: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(data))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        return ""

def _read_pdf_pdfminer(data: bytes) -> str:
    try:
        return pdfminer_extract(io.BytesIO(data))
    except Exception:
        return ""

def _read_docx(data: bytes) -> str:
    try:
        doc = Document(io.BytesIO(data))
        return "\n".join(p.text for p in doc.paragraphs)
    except Exception:
        return ""

async def extract_text_from_upload(upload: UploadFile) -> str:
    data = await upload.read()
    name = (upload.filename or "").lower()
    if name.endswith(".pdf"):
        t = _read_pdf_pypdf(data) or _read_pdf_pdfminer(data)
    elif name.endswith(".docx"):
        t = _read_docx(data)
    else:
        try:
            t = data.decode("utf-8", errors="ignore")
        except Exception:
            t = ""
    return re.sub(r"\s+", " ", t).strip()

def extract_contacts(text: str) -> dict:
    t = text or ""
    email = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", t)
    phone = re.search(r"(?:\+?\d[\d\s\-]{7,}\d)", t)
    links = re.findall(r"https?://\S+", t)
    return {
        "email": email.group(0) if email else "",
        "phone": phone.group(0) if phone else "",
        "links": ", ".join(links[:5]),
    }
