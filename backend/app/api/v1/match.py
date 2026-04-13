from fastapi import APIRouter, HTTPException, Query
from app.db.mongodb import get_db
from app.matcher import match_skills
from app.recommend import recommend_courses

router = APIRouter()

@router.get("/match")
def match(user_id: str = Query(..., description="User ID to compute match for")):
    db = get_db()

    # Resume
    doc = db.resumes.find_one({"user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="No resume found for user")
    resume_skills = doc.get("skills", []) or doc.get("parsed", {}).get("skills", [])

    # Job stats
    jobstats = db.jobstats.find_one({"_id": "global"}) or {}
    top_skills = jobstats.get("top_skills", [])

    # Compute
    overlap, missing, suitability = match_skills(resume_skills, top_skills)
    courses = recommend_courses(missing)

    return {"overlap": overlap, "missing": missing, "suitability": suitability, "courses": courses}
