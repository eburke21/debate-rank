import uuid

import pytest
from httpx import AsyncClient


class TestHealthEndpoint:
    async def test_health_returns_200(self, client: AsyncClient):
        response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["version"] == "0.1.0"


class TestTopicsEndpoint:
    async def test_no_active_topic_returns_404(self, client: AsyncClient):
        response = await client.get("/api/topics/active")
        assert response.status_code == 404

    async def test_active_topic_returns_200(self, client: AsyncClient, active_topic):
        response = await client.get("/api/topics/active")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(active_topic.id)
        assert data["title"] == active_topic.title
        assert data["argument_count"] == 0

    async def test_active_topic_counts_scored_arguments(self, client: AsyncClient, scored_argument):
        response = await client.get("/api/topics/active")
        assert response.status_code == 200
        assert response.json()["argument_count"] == 1


class TestArgumentsListEndpoint:
    async def test_empty_list_when_no_scored_arguments(self, client: AsyncClient, active_topic):
        response = await client.get("/api/arguments", params={"topic_id": str(active_topic.id)})
        assert response.status_code == 200
        data = response.json()
        assert data["arguments"] == []
        assert data["topic"]["id"] == str(active_topic.id)

    async def test_returns_scored_arguments_with_scores_dict(
        self, client: AsyncClient, scored_argument, active_topic
    ):
        response = await client.get("/api/arguments", params={"topic_id": str(active_topic.id)})
        assert response.status_code == 200
        data = response.json()
        assert len(data["arguments"]) == 1
        arg = data["arguments"][0]
        assert arg["id"] == str(scored_argument.id)
        assert arg["scores"]["logic"] == 8
        assert arg["scores"]["evidence"] == 9
        assert arg["composite_score"] == 7.0

    async def test_nonexistent_topic_returns_404(self, client: AsyncClient):
        response = await client.get("/api/arguments", params={"topic_id": str(uuid.uuid4())})
        assert response.status_code == 404


class TestArgumentDetailEndpoint:
    async def test_returns_detail_with_rationales(self, client: AsyncClient, scored_argument):
        response = await client.get(f"/api/arguments/{scored_argument.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(scored_argument.id)
        assert len(data["scores"]) == 4
        # Detail endpoint returns list of score objects with rationales
        logic_score = next(s for s in data["scores"] if s["rubric"] == "logic")
        assert logic_score["score"] == 8
        assert "rationale" in logic_score

    async def test_nonexistent_argument_returns_404(self, client: AsyncClient):
        response = await client.get(f"/api/arguments/{uuid.uuid4()}")
        assert response.status_code == 404


class TestArgumentCreateEndpoint:
    async def test_valid_submission_returns_202(self, client: AsyncClient, active_topic):
        response = await client.post(
            "/api/arguments",
            json={"body": "x" * 100, "author_name": "TestUser"},
        )
        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "pending"
        assert "id" in data
        assert data["message"] == "Argument submitted. Evaluation in progress."

    async def test_short_body_returns_422(self, client: AsyncClient, active_topic):
        response = await client.post(
            "/api/arguments",
            json={"body": "x" * 30},
        )
        assert response.status_code == 422
        data = response.json()
        assert data["error"]["code"] == "VALIDATION_ERROR"
        assert "body" in data["error"]["fields"]

    async def test_long_body_returns_422(self, client: AsyncClient, active_topic):
        response = await client.post(
            "/api/arguments",
            json={"body": "x" * 2500},
        )
        assert response.status_code == 422
        data = response.json()
        assert data["error"]["code"] == "VALIDATION_ERROR"

    async def test_no_active_topic_returns_404(self, client: AsyncClient):
        """POST without any active topic in DB returns 404."""
        response = await client.post(
            "/api/arguments",
            json={"body": "x" * 100},
        )
        assert response.status_code == 404


def _find_rate_limiter(app_obj):
    """Walk the Starlette middleware chain to find the RateLimitMiddleware instance."""
    from app.middleware.rate_limit import RateLimitMiddleware

    current = getattr(app_obj, "middleware_stack", app_obj)
    while current is not None:
        if isinstance(current, RateLimitMiddleware):
            return current
        current = getattr(current, "app", None)
    return None


class TestRateLimiting:
    @pytest.fixture(autouse=True)
    def _reset_rate_limiter(self):
        """Reset rate limiter state before and after each test."""
        from app.main import app

        limiter = _find_rate_limiter(app)
        if limiter:
            limiter._requests.clear()
        yield
        if limiter:
            limiter._requests.clear()

    async def test_rate_limit_exceeded_returns_429(self, client: AsyncClient, active_topic):
        """Sending more than RATE_LIMIT_PER_MINUTE requests returns 429."""
        # Default rate limit is 10 per minute
        for i in range(10):
            response = await client.post(
                "/api/arguments",
                json={"body": "x" * 100, "author_name": f"User{i}"},
            )
            assert response.status_code == 202, f"Request {i + 1} failed unexpectedly"

        # The 11th request should be rate limited
        response = await client.post(
            "/api/arguments",
            json={"body": "x" * 100, "author_name": "Blocked"},
        )
        assert response.status_code == 429
        data = response.json()
        assert data["error"]["code"] == "RATE_LIMITED"
        assert data["error"]["retry_after"] == 60
