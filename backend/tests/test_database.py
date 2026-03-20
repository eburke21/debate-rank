from sqlalchemy import select

from app.models import Argument, Score, Topic
from app.schemas import Rubric


async def test_insert_topic_argument_scores(db_session):
    """Insert a full Topic → Argument → 4 Scores chain and verify relationships."""
    topic = Topic(
        title="Should cities ban cars from downtown?",
        description="A test debate topic.",
    )
    db_session.add(topic)
    await db_session.flush()

    argument = Argument(
        topic_id=topic.id,
        author_name="Test Author",
        body="A" * 100,  # meets 50-char minimum
    )
    db_session.add(argument)
    await db_session.flush()

    for rubric in Rubric:
        score = Score(
            argument_id=argument.id,
            rubric=rubric.value,
            score=7,
            rationale=f"Test rationale for {rubric.value}.",
            model_id="claude-sonnet-4-20250514",
        )
        db_session.add(score)

    await db_session.flush()

    # Query back and verify
    result = await db_session.execute(select(Argument).where(Argument.id == argument.id))
    loaded_argument = result.scalar_one()

    assert loaded_argument.topic_id == topic.id
    assert loaded_argument.body == "A" * 100
    assert loaded_argument.author_name == "Test Author"
    assert loaded_argument.status == "pending"

    # Verify scores
    scores_result = await db_session.execute(select(Score).where(Score.argument_id == argument.id))
    scores = scores_result.scalars().all()
    assert len(scores) == 4

    rubric_values = {s.rubric for s in scores}
    assert rubric_values == {"logic", "evidence", "persuasion", "originality"}


async def test_cascade_delete_topic_removes_arguments(db_session):
    """Deleting a topic cascades to its arguments and scores."""
    topic = Topic(title="Cascade test topic")
    db_session.add(topic)
    await db_session.flush()

    argument = Argument(topic_id=topic.id, body="B" * 100)
    db_session.add(argument)
    await db_session.flush()

    score = Score(
        argument_id=argument.id,
        rubric="logic",
        score=5,
        rationale="Test.",
        model_id="test-model",
    )
    db_session.add(score)
    await db_session.flush()

    # Delete topic
    await db_session.delete(topic)
    await db_session.flush()

    # Argument and score should be gone
    arg_result = await db_session.execute(select(Argument).where(Argument.id == argument.id))
    assert arg_result.scalar_one_or_none() is None

    score_result = await db_session.execute(select(Score).where(Score.id == score.id))
    assert score_result.scalar_one_or_none() is None
