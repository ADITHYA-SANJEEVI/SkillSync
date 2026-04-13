from pydantic import BaseModel
from typing import List

class JDInput(BaseModel):
    job_texts: List[str]
