import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.config import settings


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
