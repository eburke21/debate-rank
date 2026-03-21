import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.schemas import JudgeOutput
from app.services.judge import evaluate_argument_all_judges, evaluate_single_judge


def _make_mock_response(text: str):
    """Create a mock Anthropic response with the given text content."""
    content_block = MagicMock()
    content_block.text = text
    response = MagicMock()
    response.content = [content_block]
    return response


def _make_mock_client(responses: list[str]):
    """Create a mock AsyncAnthropic client that returns responses in order."""
    client = MagicMock()
    client.messages = MagicMock()
    mock_create = AsyncMock(side_effect=[_make_mock_response(r) for r in responses])
    client.messages.create = mock_create
    return client


class TestJudgeOutputParsing:
    def test_valid_json_parses(self):
        result = JudgeOutput.model_validate_json('{"score": 7, "rationale": "Good argument"}')
        assert result.score == 7
        assert result.rationale == "Good argument"

    def test_valid_json_with_trailing_whitespace(self):
        result = JudgeOutput.model_validate_json('{"score": 7, "rationale": "Good argument"}  ')
        assert result.score == 7

    def test_markdown_wrapped_json_fails(self):
        with pytest.raises(Exception):
            JudgeOutput.model_validate_json('```json\n{"score": 7}\n```')

    def test_rejects_score_0(self):
        with pytest.raises(Exception):
            JudgeOutput.model_validate_json('{"score": 0, "rationale": "Bad"}')

    def test_rejects_score_11(self):
        with pytest.raises(Exception):
            JudgeOutput.model_validate_json('{"score": 11, "rationale": "Great"}')

    def test_rejects_missing_rationale(self):
        with pytest.raises(Exception):
            JudgeOutput.model_validate_json('{"score": 7}')


class TestEvaluateSingleJudge:
    async def test_returns_judge_output_on_valid_response(self):
        client = _make_mock_client(
            ['{"score": 8, "rationale": "Strong logical structure throughout."}']
        )
        result, latency_ms = await evaluate_single_judge(
            "Test argument body" * 5,
            "Test topic",
            "logic",
            client=client,
        )
        assert isinstance(result, JudgeOutput)
        assert result.score == 8
        assert latency_ms >= 0
        client.messages.create.assert_called_once()

    async def test_retries_once_on_parse_failure(self):
        client = _make_mock_client(
            [
                "This is not JSON at all",
                '{"score": 6, "rationale": "Recovered on retry."}',
            ]
        )
        result, _ = await evaluate_single_judge(
            "Test argument body" * 5,
            "Test topic",
            "evidence",
            client=client,
        )
        assert result.score == 6
        assert client.messages.create.call_count == 2

    async def test_raises_after_two_failures(self):
        client = _make_mock_client(
            [
                "Not valid JSON",
                "Still not valid JSON",
            ]
        )
        with pytest.raises(ValueError, match="failed to produce valid JSON after retry"):
            await evaluate_single_judge(
                "Test argument body" * 5,
                "Test topic",
                "logic",
                client=client,
            )

    async def test_timeout_raises_asyncio_timeout(self):
        client = MagicMock()
        client.messages = MagicMock()

        async def slow_create(**kwargs):
            await asyncio.sleep(100)  # Will be cancelled by timeout

        client.messages.create = slow_create

        with pytest.raises((asyncio.TimeoutError, TimeoutError)):
            await evaluate_single_judge(
                "Test argument body" * 5,
                "Test topic",
                "logic",
                client=client,
            )


class TestEvaluateAllJudges:
    def _mock_single_judge(self, results: dict[str, JudgeOutput | Exception]):
        """Create a side_effect function that returns rubric-specific results."""

        async def mock_evaluate(body, topic, rubric, client=None):
            result = results[rubric]
            if isinstance(result, Exception):
                raise result
            return result, 100  # 100ms fake latency

        return mock_evaluate

    async def test_all_four_succeed_status_scored(self, db_session, monkeypatch):
        """4 successes → status=scored, composite is mean of scores."""
        judge_results = {
            "logic": JudgeOutput(score=8, rationale="Good logic."),
            "evidence": JudgeOutput(score=6, rationale="Some evidence."),
            "persuasion": JudgeOutput(score=7, rationale="Persuasive."),
            "originality": JudgeOutput(score=5, rationale="Familiar."),
        }
        monkeypatch.setattr(
            "app.services.judge.evaluate_single_judge",
            self._mock_single_judge(judge_results),
        )

        # Create topic and argument in test DB
        from app.models import Argument, Topic

        topic = Topic(id=uuid.uuid4(), title="Test topic", is_active=True)
        db_session.add(topic)
        await db_session.flush()

        arg = Argument(id=uuid.uuid4(), topic_id=topic.id, body="x" * 100, status="pending")
        db_session.add(arg)
        await db_session.flush()

        await evaluate_argument_all_judges(arg.id, arg.body, topic.title, db_session)

        await db_session.refresh(arg)
        assert arg.status == "scored"
        assert arg.composite_score == (8 + 6 + 7 + 5) / 4
        assert arg.scored_at is not None

    async def test_three_succeed_one_fails_status_partial(self, db_session, monkeypatch):
        """3 successes + 1 exception → status=partial."""
        judge_results = {
            "logic": JudgeOutput(score=8, rationale="Good."),
            "evidence": ValueError("API error"),
            "persuasion": JudgeOutput(score=7, rationale="OK."),
            "originality": JudgeOutput(score=5, rationale="Meh."),
        }
        monkeypatch.setattr(
            "app.services.judge.evaluate_single_judge",
            self._mock_single_judge(judge_results),
        )

        from app.models import Argument, Topic

        topic = Topic(id=uuid.uuid4(), title="Test", is_active=True)
        db_session.add(topic)
        await db_session.flush()

        arg = Argument(id=uuid.uuid4(), topic_id=topic.id, body="x" * 100, status="pending")
        db_session.add(arg)
        await db_session.flush()

        await evaluate_argument_all_judges(arg.id, arg.body, topic.title, db_session)

        await db_session.refresh(arg)
        assert arg.status == "partial"
        assert arg.composite_score == (8 + 7 + 5) / 3
        assert arg.scored_at is not None

    async def test_one_succeed_three_fail_status_failed(self, db_session, monkeypatch):
        """1 success + 3 exceptions → status=failed."""
        judge_results = {
            "logic": JudgeOutput(score=8, rationale="Good."),
            "evidence": ValueError("API error"),
            "persuasion": ValueError("Timeout"),
            "originality": ValueError("Parse error"),
        }
        monkeypatch.setattr(
            "app.services.judge.evaluate_single_judge",
            self._mock_single_judge(judge_results),
        )

        from app.models import Argument, Topic

        topic = Topic(id=uuid.uuid4(), title="Test", is_active=True)
        db_session.add(topic)
        await db_session.flush()

        arg = Argument(id=uuid.uuid4(), topic_id=topic.id, body="x" * 100, status="pending")
        db_session.add(arg)
        await db_session.flush()

        await evaluate_argument_all_judges(arg.id, arg.body, topic.title, db_session)

        await db_session.refresh(arg)
        assert arg.status == "failed"
        assert arg.composite_score is None

    async def test_all_four_fail_status_failed(self, db_session, monkeypatch):
        """4 exceptions → status=failed, composite=None."""
        judge_results = {
            "logic": ValueError("Error 1"),
            "evidence": ValueError("Error 2"),
            "persuasion": ValueError("Error 3"),
            "originality": ValueError("Error 4"),
        }
        monkeypatch.setattr(
            "app.services.judge.evaluate_single_judge",
            self._mock_single_judge(judge_results),
        )

        from app.models import Argument, Topic

        topic = Topic(id=uuid.uuid4(), title="Test", is_active=True)
        db_session.add(topic)
        await db_session.flush()

        arg = Argument(id=uuid.uuid4(), topic_id=topic.id, body="x" * 100, status="pending")
        db_session.add(arg)
        await db_session.flush()

        await evaluate_argument_all_judges(arg.id, arg.body, topic.title, db_session)

        await db_session.refresh(arg)
        assert arg.status == "failed"
        assert arg.composite_score is None
        assert arg.scored_at is None
