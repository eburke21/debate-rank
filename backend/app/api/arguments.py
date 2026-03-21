import logging
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import async_session, get_db
from app.models import Argument, Topic
from app.schemas import (
    ArgumentCreate,
    ArgumentDetail,
    ArgumentSubmitResponse,
    ArgumentSummary,
    LeaderboardResponse,
    Rubric,
    ScoreResponse,
    TopicResponse,
)
from app.services.judge import evaluate_argument_all_judges
from app.services.sanitization import sanitize_argument_body

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/arguments", tags=["arguments"])


def _build_summary(arg: Argument) -> ArgumentSummary:
    """Convert an Argument ORM object to an ArgumentSummary schema."""
    scores_dict = {Rubric(s.rubric): s.score for s in arg.scores}
    return ArgumentSummary(
        id=arg.id,
        body=arg.body,
        author_name=arg.author_name,
        status=arg.status,
        scores=scores_dict,
        composite_score=arg.composite_score,
        submitted_at=arg.submitted_at,
    )


@router.get("", response_model=LeaderboardResponse)
async def list_arguments(topic_id: UUID, db: AsyncSession = Depends(get_db)):
    """Return all scored arguments for a topic (leaderboard data)."""
    # Verify topic exists
    topic_result = await db.execute(select(Topic).where(Topic.id == topic_id))
    topic = topic_result.scalar_one_or_none()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Count scored/partial arguments for the topic response
    result = await db.execute(
        select(Argument)
        .where(
            Argument.topic_id == topic_id,
            Argument.status.in_(["scored", "partial"]),
        )
        .options(selectinload(Argument.scores))
        .order_by(Argument.composite_score.desc().nulls_last())
    )
    arguments = result.scalars().all()

    topic_response = TopicResponse(
        id=topic.id,
        title=topic.title,
        description=topic.description,
        argument_count=len(arguments),
    )

    return LeaderboardResponse(
        topic=topic_response,
        arguments=[_build_summary(arg) for arg in arguments],
    )


@router.get("/{argument_id}", response_model=ArgumentDetail)
async def get_argument(argument_id: UUID, db: AsyncSession = Depends(get_db)):
    """Return full argument detail including judge rationales."""
    result = await db.execute(
        select(Argument).where(Argument.id == argument_id).options(selectinload(Argument.scores))
    )
    argument = result.scalar_one_or_none()

    if argument is None:
        raise HTTPException(status_code=404, detail="Argument not found")

    scores = [
        ScoreResponse(rubric=Rubric(s.rubric), score=s.score, rationale=s.rationale)
        for s in argument.scores
    ]

    return ArgumentDetail(
        id=argument.id,
        body=argument.body,
        author_name=argument.author_name,
        status=argument.status,
        scores=scores,
        composite_score=argument.composite_score,
        submitted_at=argument.submitted_at,
        scored_at=argument.scored_at,
    )


async def _run_judge_evaluation(argument_id: UUID, argument_body: str, topic_title: str):
    """Background task: evaluate argument with all judges using a fresh DB session."""
    async with async_session() as db:
        try:
            await evaluate_argument_all_judges(argument_id, argument_body, topic_title, db)
        except Exception:
            logger.exception("Judge evaluation failed for argument %s", argument_id)


@router.post("", response_model=ArgumentSubmitResponse, status_code=202)
async def create_argument(
    payload: ArgumentCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Submit a new argument for evaluation."""
    # Find the active topic
    topic_result = await db.execute(select(Topic).where(Topic.is_active.is_(True)))
    topic = topic_result.scalar_one_or_none()
    if topic is None:
        raise HTTPException(status_code=404, detail="No active topic found")

    # Sanitize input
    sanitized_body = sanitize_argument_body(payload.body)

    # Create argument row with status: pending
    argument = Argument(
        topic_id=topic.id,
        body=sanitized_body,
        author_name=payload.author_name,
    )
    db.add(argument)
    await db.commit()
    await db.refresh(argument)

    # Dispatch judge evaluation as background task
    background_tasks.add_task(_run_judge_evaluation, argument.id, sanitized_body, topic.title)

    return ArgumentSubmitResponse(
        id=argument.id,
        status=argument.status,
        message="Argument submitted. Evaluation in progress.",
    )
