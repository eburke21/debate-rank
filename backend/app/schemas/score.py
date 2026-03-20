from enum import StrEnum

from pydantic import BaseModel, Field


class Rubric(StrEnum):
    LOGIC = "logic"
    EVIDENCE = "evidence"
    PERSUASION = "persuasion"
    ORIGINALITY = "originality"


class ScoreResponse(BaseModel):
    rubric: Rubric
    score: int = Field(ge=1, le=10)
    rationale: str


class JudgeOutput(BaseModel):
    """Parsed from LLM JSON response."""

    score: int = Field(ge=1, le=10)
    rationale: str = Field(max_length=2000)
