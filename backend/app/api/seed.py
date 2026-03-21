import json
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks
from sqlalchemy import func, select
from starlette.responses import JSONResponse

from app.database import async_session
from app.models import Argument, Topic
from app.services.judge import evaluate_argument_all_judges

router = APIRouter(prefix="/api", tags=["seed"])

SEED_DATA_PATH = Path(__file__).parent.parent.parent / "data" / "seed_arguments.json"

SEED_TOPIC_TITLE = "Should cities ban cars from downtown?"
SEED_TOPIC_DESCRIPTION = (
    "Consider environmental, economic, accessibility, and quality-of-life impacts. "
    "What's the strongest argument you can make for or against?"
)


async def _run_seed() -> None:
    """Background task: insert seed arguments and evaluate them."""
    seed_args = json.loads(SEED_DATA_PATH.read_text())

    async with async_session() as db:
        # Get or create topic
        result = await db.execute(select(Topic).where(Topic.is_active.is_(True)))
        topic = result.scalar_one_or_none()

        if topic is None:
            topic = Topic(title=SEED_TOPIC_TITLE, description=SEED_TOPIC_DESCRIPTION)
            db.add(topic)
            await db.flush()

        # Insert arguments
        arguments = []
        for arg_data in seed_args:
            argument = Argument(
                topic_id=topic.id,
                body=arg_data["body"],
                author_name=arg_data.get("author_name"),
            )
            db.add(argument)
            await db.flush()
            arguments.append(argument)

        await db.commit()

        # Evaluate each argument (separate session per evaluation for partial commit safety)
        for argument in arguments:
            try:
                async with async_session() as eval_db:
                    await evaluate_argument_all_judges(
                        argument_id=argument.id,
                        argument_body=argument.body,
                        topic_title=topic.title,
                        db=eval_db,
                    )
                    await eval_db.commit()
            except Exception:
                # Continue seeding even if one argument fails evaluation
                pass


@router.post("/seed")
async def seed_database(background_tasks: BackgroundTasks):
    """Seed the database with sample arguments and trigger LLM evaluation."""
    # Check if already seeded
    async with async_session() as db:
        result = await db.execute(select(func.count()).select_from(Argument))
        count = result.scalar_one()

    if count > 0:
        return JSONResponse(
            status_code=409,
            content={"message": "Database already has arguments. Reset first to re-seed."},
        )

    if not SEED_DATA_PATH.exists():
        return JSONResponse(
            status_code=500,
            content={"message": "Seed data file not found."},
        )

    background_tasks.add_task(_run_seed)

    return JSONResponse(
        status_code=202,
        content={"message": "Seeding started. Arguments will appear as they are evaluated."},
    )
