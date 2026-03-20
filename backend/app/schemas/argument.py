from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.score import Rubric, ScoreResponse
from app.schemas.topic import TopicResponse


class ArgumentStatus(StrEnum):
    PENDING = "pending"
    SCORING = "scoring"
    SCORED = "scored"
    PARTIAL = "partial"
    FAILED = "failed"


class ArgumentCreate(BaseModel):
    body: str = Field(min_length=50, max_length=2000)
    author_name: str | None = Field(default=None, max_length=100)


class ArgumentSummary(BaseModel):
    """Leaderboard row — includes scores but not full rationales."""

    id: UUID
    body: str
    author_name: str | None
    status: ArgumentStatus
    scores: dict[Rubric, int]
    composite_score: float | None
    submitted_at: datetime


class ArgumentDetail(BaseModel):
    """Full detail view — includes rationales."""

    id: UUID
    body: str
    author_name: str | None
    status: ArgumentStatus
    scores: list[ScoreResponse]
    composite_score: float | None
    submitted_at: datetime
    scored_at: datetime | None


class ArgumentSubmitResponse(BaseModel):
    id: UUID
    status: ArgumentStatus
    message: str


class LeaderboardResponse(BaseModel):
    topic: TopicResponse
    arguments: list[ArgumentSummary]
