# app/ml/models.py
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field

# --- Pydantic v1/v2 compatibility helpers -----------------------------------
try:
    # Pydantic v2
    from pydantic import ConfigDict
    from pydantic.functional_validators import field_validator as _field_validator

    def field_validator(*fields, **kwargs):
        return _field_validator(*fields, **kwargs)

    _MODEL_CONFIG = {"extra": "ignore"}  # ignore unexpected fields safely
    V2 = True
except Exception:
    # Pydantic v1
    from pydantic.class_validators import validator as _validator

    def field_validator(*fields, **kwargs):
        # map to v1 @validator
        return _validator(*fields, **kwargs)

    _MODEL_CONFIG = type("Config", (), {"extra": "ignore"})  # ignore unexpected fields safely
    V2 = False


# --- Common lower-casing normalizer ------------------------------------------
def _lower_list(values: Optional[List[str]]) -> List[str]:
    if not values:
        return []
    return [v.strip().lower() for v in values if isinstance(v, str) and v.strip()]


# --- Core request/response models used by ML endpoints -----------------------

class ExtractRequest(BaseModel):
    """Request body: free text (resume/job snippet) to extract skills & infer role."""
    text: str = Field(..., min_length=1, description="Raw text to analyze (resume/job post/summary).")

    if V2:
        model_config = ConfigDict(**_MODEL_CONFIG)  # type: ignore
    else:
        Config = _MODEL_CONFIG  # type: ignore


class RoleGuess(BaseModel):
    """Model + score for the top role guess."""
    role: str = Field(..., description="Predicted role name/title.")
    score: float = Field(..., ge=0.0, le=1.0, description="Confidence score in [0,1].")

    if V2:
        model_config = ConfigDict(**_MODEL_CONFIG)  # type: ignore
    else:
        Config = _MODEL_CONFIG  # type: ignore


class ExtractResponse(BaseModel):
    """Extracted skills and a best-guess role."""
    skills: List[str] = Field(default_factory=list, description="Normalized skills from text.")
    role_guess: RoleGuess = Field(..., description="Best-guess role + score.")

    # normalize skills to lowercase (tolerant to any input)
    @field_validator("skills", mode="before")
    def _skills_to_lower(cls, v):
        return _lower_list(v)

    if V2:
        model_config = ConfigDict(**_MODEL_CONFIG)  # type: ignore
    else:
        Config = _MODEL_CONFIG  # type: ignore


class GapRequest(BaseModel):
    """Compare candidate vs job skills to compute gaps/coverage."""
    candidate_skills: List[str] = Field(default_factory=list, description="Skills from the candidate.")
    job_skills: List[str] = Field(default_factory=list, description="Skills required by the job.")

    # normalize to lowercase to make set ops deterministic
    @field_validator("candidate_skills", mode="before")
    def _cand_to_lower(cls, v):
        return _lower_list(v)

    @field_validator("job_skills", mode="before")
    def _job_to_lower(cls, v):
        return _lower_list(v)

    if V2:
        model_config = ConfigDict(**_MODEL_CONFIG)  # type: ignore
    else:
        Config = _MODEL_CONFIG  # type: ignore


class GapResponse(BaseModel):
    """Result of skill-gap computation."""
    missing_skills: List[str] = Field(default_factory=list)
    matched_skills: List[str] = Field(default_factory=list)
    coverage: float = Field(..., ge=0.0, le=1.0, description="|matched| / |job_skills| in [0,1].")

    # keep outputs normalized
    @field_validator("missing_skills", "matched_skills", mode="before")
    def _lists_lower(cls, v):
        return _lower_list(v)

    if V2:
        model_config = ConfigDict(**_MODEL_CONFIG)  # type: ignore
    else:
        Config = _MODEL_CONFIG  # type: ignore


class RecommendRequest(BaseModel):
    """Request courses for a list of missing skills."""
    missing_skills: List[str] = Field(default_factory=list, description="Skills to target with learning content.")

    @field_validator("missing_skills", mode="before")
    def _missing_to_lower(cls, v):
        return _lower_list(v)

    if V2:
        model_config = ConfigDict(**_MODEL_CONFIG)  # type: ignore
    else:
        Config = _MODEL_CONFIG  # type: ignore


# --- Course objects & recommend response (future-proofed) ---------------------

class Course(BaseModel):
    """Minimal course representation used in recommendations."""
    id: str
    title: str
    provider: Optional[str] = None
    url: Optional[str] = None
    desc: Optional[str] = None
    skills: List[str] = Field(default_factory=list)

    @field_validator("skills", mode="before")
    def _skills_to_lower(cls, v):
        return _lower_list(v)

    if V2:
        model_config = ConfigDict(**_MODEL_CONFIG)  # type: ignore
    else:
        Config = _MODEL_CONFIG  # type: ignore


class RecommendResponse(BaseModel):
    """List of recommended courses (optionally paginated later)."""
    courses: List[Course] = Field(default_factory=list)

    if V2:
        model_config = ConfigDict(**_MODEL_CONFIG)  # type: ignore
    else:
        Config = _MODEL_CONFIG  # type: ignore


# --- Optional: generic error shape (handy for raises/HTTPException detail) ---

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None

    if V2:
        model_config = ConfigDict(**_MODEL_CONFIG)  # type: ignore
    else:
        Config = _MODEL_CONFIG  # type: ignore


# Public exports
__all__ = [
    "ExtractRequest",
    "ExtractResponse",
    "RoleGuess",
    "GapRequest",
    "GapResponse",
    "RecommendRequest",
    "Course",
    "RecommendResponse",
    "ErrorResponse",
]
