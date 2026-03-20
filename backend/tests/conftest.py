import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.config import settings
from app.database import get_db
from app.main import app
from app.models import Argument, Score, Topic


@pytest.fixture
async def db_session():
    """Provide a transactional async DB session that rolls back after each test."""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)

    async with engine.connect() as conn:
        transaction = await conn.begin()
        session = AsyncSession(bind=conn, expire_on_commit=False)

        yield session

        await session.close()
        await transaction.rollback()

    await engine.dispose()


@pytest.fixture
async def client(db_session):
    """Provide an httpx AsyncClient wired to the FastAPI app with DB override."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def active_topic(db_session) -> Topic:
    """Seed an active topic and return it."""
    topic = Topic(
        id=uuid.uuid4(),
        title="Should cities ban cars from downtown?",
        description="Consider environmental, economic, and quality-of-life impacts.",
        is_active=True,
    )
    db_session.add(topic)
    await db_session.flush()
    return topic


@pytest.fixture
async def scored_argument(db_session, active_topic) -> Argument:
    """Seed a scored argument with 4 scores under the active topic."""
    arg = Argument(
        id=uuid.uuid4(),
        topic_id=active_topic.id,
        body="x" * 100,
        author_name="TestUser",
        status="scored",
        composite_score=7.0,
    )
    db_session.add(arg)
    await db_session.flush()

    rubrics = [
        ("logic", 8, "Strong logical structure."),
        ("evidence", 9, "Well-supported with data."),
        ("persuasion", 5, "Dry presentation."),
        ("originality", 6, "Familiar angle."),
    ]
    for rubric, score, rationale in rubrics:
        s = Score(
            id=uuid.uuid4(),
            argument_id=arg.id,
            rubric=rubric,
            score=score,
            rationale=rationale,
            model_id="claude-sonnet-4-20250514",
        )
        db_session.add(s)

    await db_session.flush()
    return arg
