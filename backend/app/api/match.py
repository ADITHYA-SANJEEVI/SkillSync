from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()

class MatchIn(BaseModel):
    resume_text: str
    resume_skills: List[str] = []
    top_k: int = 5

class MatchOut(BaseModel):
    results: List[dict]

@router.post("/match", response_model=MatchOut, summary="Match resume to jobs (demo)")
def match_endpoint(body: MatchIn):
    # minimal demo scores
    demo = [
        {"id":"1","title":"ML Engineer","company":"Acme","score":0.91},
        {"id":"2","title":"Data Scientist","company":"Globex","score":0.78},
    ][: body.top_k]
    return MatchOut(results=demo)
