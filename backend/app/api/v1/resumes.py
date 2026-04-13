from fastapi import APIRouter, UploadFile, File, Query, HTTPException
from app.parsers import extract_text_from_pdf, parse_resume
from app.db.mongodb import get_db

router = APIRouter()

MAX_MB = 5

@router.post("/upload-resume")
async def upload_resume(user_id: str = Query(...), file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(415, detail="Only PDF is supported")
    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_MB * 1024 * 1024:
        raise HTTPException(413, detail="File too large")

    text = extract_text_from_pdf(pdf_bytes)
    parsed = parse_resume(text)

    db = get_db()
    db.resumes.update_one(
        {"user_id": user_id},
        {"$set": {"user_id": user_id, "text": text, **parsed}},
        upsert=True,
    )
    return {"user_id": user_id, **parsed}
