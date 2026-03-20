from uuid import UUID

from pydantic import BaseModel


class TopicResponse(BaseModel):
    id: UUID
    title: str
    description: str | None
    argument_count: int
