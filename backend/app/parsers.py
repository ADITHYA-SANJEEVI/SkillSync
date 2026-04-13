import re
import io
import fitz  # PyMuPDF

_SKILL_REGEX = re.compile(
    r"\b(python|java|c\+\+|c#|javascript|typescript|react|node\.js|django|flask|fastapi|"
    r"pandas|numpy|scikit-learn|sql|postgres|mysql|mongodb|aws|azure|gcp|docker|kubernetes|"
    r"git|tableau|power bi|spark|hadoop|nlp|computer vision|tensorflow|pytorch)\b",
    re.IGNORECASE,
)

def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Robust PDF text extractor using PyMuPDF."""
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        chunks = []
        for page in doc:
            chunks.append(page.get_text("text"))
    text = "\n".join(chunks)
    # normalize whitespace
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

def parse_resume(text: str) -> dict:
    """Very simple parser (regex-based), no external model required."""
    # naive sections
    education = []
    projects = []

    # skills: use regex hits, unique + normalized
    skills = {m.group(0).lower() for m in _SKILL_REGEX.finditer(text)}
    skills = sorted(skills)

    # naive heuristics for education & projects
    for line in text.splitlines():
        l = line.strip()
        if re.search(r"(B\.?Tech|B\.?E\.?|M\.?Tech|BSc|MSc|Bachelor|Master|University|College)", l, re.I):
            education.append(l)
        if re.search(r"(project|built|developed|created|implemented)", l, re.I):
            projects.append(l)

    # cap sizes to keep docs small
    education = education[:10]
    projects = projects[:20]

    return {"skills": skills, "education": education, "projects": projects}
