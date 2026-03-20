import uuid

from sqlalchemy import CheckConstraint, DateTime, Float, ForeignKey, Index, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

TZDateTime = DateTime(timezone=True)


class Argument(Base):
    __tablename__ = "arguments"
    __table_args__ = (
        CheckConstraint("char_length(body) BETWEEN 50 AND 2000", name="body_length"),
        Index("idx_arguments_topic_id", "topic_id"),
        Index("idx_arguments_status", "status"),
        Index("idx_arguments_composite_score", "composite_score"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    topic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("topics.id", ondelete="CASCADE"),
        nullable=False,
    )
    author_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'pending'"))
    composite_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    submitted_at = mapped_column(TZDateTime, nullable=False, server_default=text("now()"))
    scored_at = mapped_column(TZDateTime, nullable=True)
    created_at = mapped_column(TZDateTime, nullable=False, server_default=text("now()"))

    topic = relationship("Topic", back_populates="arguments")
    scores = relationship("Score", back_populates="argument", cascade="all, delete-orphan")
