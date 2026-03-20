from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Argument, Topic
from app.schemas import TopicResponse

router = APIRouter(prefix="/api/topics", tags=["topics"])


@router.get("/active", response_model=TopicResponse)
async def get_active_topic(db: AsyncSession = Depends(get_db)):
    """Return the currently active debate topic with argument count."""
    result = await db.execute(select(Topic).where(Topic.is_active.is_(True)))
    topic = result.scalar_one_or_none()

    if topic is None:
        raise HTTPException(status_code=404, detail="No active topic found")

    count_result = await db.execute(
        select(func.count())
        .select_from(Argument)
        .where(
            Argument.topic_id == topic.id,
            Argument.status.in_(["scored", "partial"]),
        )
    )
    argument_count = count_result.scalar_one()

    return TopicResponse(
        id=topic.id,
        title=topic.title,
        description=topic.description,
        argument_count=argument_count,
    )
