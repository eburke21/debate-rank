import uuid

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

TZDateTime = DateTime(timezone=True)


class Score(Base):
    __tablename__ = "scores"
    __table_args__ = (
        CheckConstraint(
            "rubric IN ('logic', 'evidence', 'persuasion', 'originality')",
            name="valid_rubric",
        ),
        CheckConstraint("score BETWEEN 1 AND 10", name="valid_score"),
        UniqueConstraint("argument_id", "rubric", name="uq_argument_rubric"),
        Index("idx_scores_argument_id", "argument_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    argument_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("arguments.id", ondelete="CASCADE"),
        nullable=False,
    )
    rubric: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    model_id: Mapped[str] = mapped_column(Text, nullable=False)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at = mapped_column(TZDateTime, nullable=False, server_default=text("now()"))

    argument = relationship("Argument", back_populates="scores")
