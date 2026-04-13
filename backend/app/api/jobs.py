from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import List

router = APIRouter()

class Job(BaseModel):
    id: str
    title: str
    company: str
    location: str
    description: str

class AnalyzeJobsResponse(BaseModel):
    total: int
    jobs: List[Job]

@router.post("/analyze-jobs", response_model=AnalyzeJobsResponse, summary="Analyze Jobs")
def analyze_jobs(provider: str = Query("csv", enum=["csv","naukri","linkedin"]), limit: int = 20):
    sample = [
        Job(id="1", title="ML Engineer", company="Acme", location="Remote", description="Python, XGBoost, AWS"),
        Job(id="2", title="Data Scientist", company="Globex", location="IN", description="Pandas, SQL, MLflow"),
    ][:limit]
    return AnalyzeJobsResponse(total=len(sample), jobs=sample)
