import uuid

from sqlalchemy import Boolean, DateTime, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

TZDateTime = DateTime(timezone=True)


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    created_at = mapped_column(TZDateTime, nullable=False, server_default=text("now()"))
    updated_at = mapped_column(TZDateTime, nullable=False, server_default=text("now()"))

    arguments = relationship("Argument", back_populates="topic", cascade="all, delete-orphan")
