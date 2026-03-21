# CLAUDE.md

## Project Overview

DebateRank is a multi-criteria LLM-as-judge evaluation platform. Users submit debate arguments, 4 LLM judges (Logic, Evidence, Persuasion, Originality) score each argument, and a leaderboard ranks them with configurable weight sliders. Built as a portfolio project demonstrating AI evaluation infrastructure.

## Architecture

Monorepo with two isolated packages communicating over HTTP:

- **Backend** (`backend/`): Python 3.12+, FastAPI, SQLAlchemy async, PostgreSQL, Anthropic SDK
- **Frontend** (`frontend/`): React 19, TypeScript, Vite, Chakra UI v3, Recharts

Orchestrated via Docker Compose (db, backend, frontend services).

## Quick Reference

### Start everything
```bash
docker compose up --build
```
- Backend: http://localhost:8000
- Frontend: http://localhost:5173
- Health check: `curl http://localhost:8000/api/health`

### Backend commands (run from `backend/`)
```bash
uv sync                          # Install dependencies
uv run uvicorn app.main:app --reload  # Run dev server standalone
uv run ruff check .              # Lint
uv run ruff format --check .     # Format check
uv run ruff format .             # Auto-format
uv run pytest tests/ -v          # Run all tests (58 total, requires running Postgres)
uv run pytest tests/test_schemas.py -v    # Schema validation tests only (17, no DB needed)
uv run pytest tests/test_sanitization.py -v  # Sanitization unit tests (5, no DB needed)
uv run pytest tests/test_scoring.py -v   # Composite scoring unit tests (6, no DB needed)
uv run pytest tests/test_database.py -v   # DB integration tests (2, requires Postgres)
uv run pytest tests/test_api.py -v        # API integration tests (14, requires Postgres)
uv run pytest tests/test_judge.py -v      # Judge system tests (14, requires Postgres for orchestrator)
```

### Alembic migrations (run from `backend/`, requires DATABASE_URL)
```bash
DATABASE_URL=postgresql+asyncpg://debaterank:localdev@localhost:5432/debaterank \
  uv run alembic upgrade head                        # Apply all migrations
DATABASE_URL=postgresql+asyncpg://debaterank:localdev@localhost:5432/debaterank \
  uv run alembic revision --autogenerate -m "desc"   # Generate migration from model changes
DATABASE_URL=postgresql+asyncpg://debaterank:localdev@localhost:5432/debaterank \
  uv run alembic current                             # Check current migration state
```
Note: Alembic runs synchronously — `env.py` swaps `+asyncpg` → `+psycopg2` automatically. The `psycopg2-binary` dev dependency exists for this purpose.

### Seed script (run from `backend/`, requires DATABASE_URL)
```bash
uv run python -m scripts.seed                    # Full seed with LLM evaluation (needs ANTHROPIC_API_KEY)
uv run python -m scripts.seed --dry-run           # Preview without DB or API calls
uv run python -m scripts.seed --skip-evaluation   # Insert rows without judging (DB only)
uv run python -m scripts.seed --reset             # Delete all data, then re-seed
uv run python -m scripts.seed --reset --skip-evaluation  # Fresh insert without judging
```
Expected runtime: ~2-3 min for 12 arguments. Expected API cost: ~$0.10-0.30.

### Frontend commands (run from `frontend/`)
```bash
npm install                      # Install dependencies
npm run dev                      # Run dev server
npm run build                    # Type-check + build
npm run lint                     # ESLint
npx tsc --noEmit                 # Type-check only
```

## Code Conventions

### Backend (Python)
- **Package manager:** uv (not pip). Always use `uv run` to execute commands.
- **Linting:** Ruff with rules E, F, I, UP. Target Python 3.12. Line length 100.
- **Testing:** pytest with `asyncio_mode = "auto"` — no need for `@pytest.mark.asyncio`.
- **Config:** All settings via `pydantic-settings.BaseSettings` in `app/config.py`. Environment variables, not hardcoded values.
- **DB driver:** `asyncpg` via `postgresql+asyncpg://` connection strings. All database access is async.
- **SQLAlchemy models:** Use `server_default=text(...)` for DB-generated defaults (UUIDs, timestamps, status). Use `TZDateTime = DateTime(timezone=True)` alias for timestamp columns (not `TIMESTAMPTZ` — SQLAlchemy doesn't export it).
- **Barrel exports:** `app/models/__init__.py` must import all models so `Base.metadata` is fully populated for Alembic autogenerate. Same pattern in `app/schemas/__init__.py`.
- **Enums:** Use `StrEnum` (not `(str, Enum)`) — required by Ruff UP042 for Python 3.12 target.
- **Imports:** Use absolute imports from `app.*` (e.g., `from app.models import Topic`).
- **Models vs Schemas:** SQLAlchemy models in `app/models/`, Pydantic request/response models in `app/schemas/`. Don't mix them.
- **Route handlers:** Thin translation layer — validate input (Pydantic), query (SQLAlchemy with `selectinload`), transform (ORM → schema), respond. No business logic in routes; sanitization in `services/`, rate limiting in `middleware/`.
- **Eager loading:** Always use `selectinload(Argument.scores)` when querying arguments that need scores. Lazy loading fails in async context (`MissingGreenlet`).
- **Error envelope:** All errors use `{"error": {"code": "...", "message": "...", "fields": {...}}}`. Validation errors (422) are reshaped from Pydantic's format via a global `RequestValidationError` exception handler.
- **Ruff excludes:** `alembic/versions/` is excluded from linting (auto-generated migration code).
- **LLM judge calls:** Use `AsyncAnthropic` from the `anthropic` SDK. Judge functions accept an optional `client` parameter for test injection; production creates a default client per call (SDK manages connection pooling internally).
- **Background tasks:** `BackgroundTasks` callbacks run after the response is sent, outside the request's DI scope. They must create their own DB session via `async_session()`, not reuse the request's session.
- **Timestamps:** Use `datetime.now(UTC)` (not deprecated `datetime.utcnow()`). Import `UTC` from `datetime`.
- **Latency measurement:** Use `time.monotonic()` for duration calculations, not `time.time()` (immune to clock adjustments).

### Frontend (TypeScript/React)
- **UI library:** Chakra UI v3 — uses `createSystem()` / `defineConfig()`, NOT v2's `extendTheme()`.
- **Rubric colors:** Defined as semantic tokens in `src/theme/index.ts` — use `rubric.logic`, `rubric.evidence`, `rubric.persuasion`, `rubric.originality` instead of raw color values.
- **HTTP client:** axios (configured in `src/api/client.ts`).
- **Charts:** Recharts for data visualization.

## Project Structure

```
backend/
  app/
    config.py          # pydantic-settings config (DATABASE_URL, ANTHROPIC_API_KEY, etc.)
    main.py            # FastAPI app, CORS, routers, middleware, exception handler
    database.py        # Async engine, session factory, Base, get_db dependency
    models/            # SQLAlchemy models (Topic, Argument, Score) + barrel __init__.py
    schemas/           # Pydantic request/response models + enums + error envelope + barrel __init__.py
    api/               # Route handlers: health.py, topics.py, arguments.py
    services/          # Business logic: sanitization.py, judge.py (LLM evaluation), scoring.py (weighted composite)
    middleware/        # rate_limit.py — IP-based, POST /api/arguments only
  data/
    seed_arguments.json # 12 curated arguments targeting diverse rubric profiles
  scripts/
    seed.py            # Seed pipeline: load JSON, insert, evaluate, report (--dry-run, --reset, --skip-evaluation)
  alembic/
    env.py             # Customized: swaps asyncpg→psycopg2, imports Base from app.models
    versions/          # Auto-generated migration files (excluded from ruff)
  tests/
    conftest.py        # Fixtures: db_session (rollback), client (httpx+DI override), active_topic, scored_argument
    test_schemas.py    # 17 Pydantic validation tests
    test_sanitization.py # 5 sanitization unit tests
    test_database.py   # 2 integration tests (insert chain, cascade delete)
    test_api.py        # 14 API integration tests (CRUD, validation, rate limiting)
    test_judge.py      # 14 judge tests (output parsing, single judge, orchestrator)
    test_scoring.py    # 6 composite weighted score tests

frontend/src/
  theme/index.ts     # Chakra UI v3 system + rubric color tokens
  api/client.ts      # Axios API client
  components/        # React components
  hooks/             # Custom hooks (useLeaderboard, useWeights, useArgumentPolling)
  types/index.ts     # Shared TypeScript types
```

## Key Design Decisions

- **4 rubrics:** Logic, Evidence, Persuasion, Originality — each scored 1-10 by a separate LLM judge call
- **Composite scoring:** Weighted average using user-adjustable sliders (recomputed client-side)
- **Argument body:** 50-2000 characters (validated in both Pydantic schema and DB CHECK constraint — defense in depth)
- **Score uniqueness:** One score per (argument_id, rubric) pair enforced by UNIQUE constraint
- **Server-side defaults:** UUIDs (`gen_random_uuid()`), timestamps (`now()`), and status (`'pending'`) generated by PostgreSQL via `server_default=text(...)` — not Python-side
- **Two response shapes:** `ArgumentSummary` uses `dict[Rubric, int]` for leaderboard (efficient client-side weight math); `ArgumentDetail` uses `list[ScoreResponse]` for detail view (includes rationales)
- **Test isolation:** Transaction rollback pattern — each test runs in a transaction that rolls back, no data persists, no cleanup needed
- **Alembic on startup:** `docker-compose.yml` backend command runs `alembic upgrade head` before starting uvicorn
- **Rate limiting:** In-memory, IP-based, 10/min on `POST /api/arguments` only. Sliding window with timestamp pruning. Scoped via path+method check in middleware.
- **Input sanitization:** `services/sanitization.py` — strip whitespace, strip HTML tags (regex), collapse 3+ newlines to 2, normalize unicode (NFC). No external dependencies.
- **LeaderboardResponse wrapper:** `GET /api/arguments` returns `{topic: TopicResponse, arguments: list[ArgumentSummary]}` — not a bare list. Composite shape matching spec §5.2.
- **API test pattern:** `httpx.AsyncClient` with `ASGITransport` + `app.dependency_overrides[get_db]` to swap in rollback session. Tests go through full ASGI stack (middleware, routing, serialization).
- **Judge model:** `claude-sonnet-4-20250514` with 30-second per-call timeout via `asyncio.wait_for()`.
- **Parallel judge dispatch:** `asyncio.gather(*tasks, return_exceptions=True)` — 4 judges run concurrently, partial failures produce partial results instead of total failure.
- **Retry on parse failure:** If a judge's response isn't valid JSON, a correction prompt (with the error and original response) is sent once. Two consecutive failures raise `ValueError`.
- **Status state machine:** `pending` → `scored` (4/4 succeed), `partial` (2-3/4), or `failed` (0-1/4). Composite score is the mean of successful scores (None if failed).
- **Background task dispatch:** `POST /api/arguments` returns 202 immediately. Judge evaluation runs as a `BackgroundTasks` callback with its own DB session.
- **Judge test isolation:** Orchestrator tests use `monkeypatch.setattr("app.services.judge.evaluate_single_judge", mock)` to control per-rubric results. Single judge tests use injectable `client` parameter with `AsyncMock`.
- **Seed data design:** 12 hand-crafted arguments with deliberate asymmetry across rubrics — each argument targets a specific archetype (data-heavy, vivid anecdote, contrarian take, etc.) so weight sliders produce visible ranking changes. Scores are live-evaluated, not hardcoded.
- **Seed script invocation:** Run as `uv run python -m scripts.seed` (not `python scripts/seed.py`) so `app.*` imports resolve correctly. `scripts/__init__.py` exists for this purpose.

## API Endpoints

| Method | Path | Status | Response |
|--------|------|--------|----------|
| `GET` | `/api/health` | 200 | `{"status": "healthy", "version": "0.1.0"}` |
| `GET` | `/api/topics/active` | 200 / 404 | `TopicResponse` with argument count |
| `GET` | `/api/arguments?topic_id=` | 200 / 404 | `LeaderboardResponse` (topic + scored arguments with `dict` scores) |
| `GET` | `/api/arguments/{id}` | 200 / 404 | `ArgumentDetail` (scores as `list` with rationales) |
| `POST` | `/api/arguments` | 202 / 422 / 429 | `ArgumentSubmitResponse` — creates argument, dispatches judge evaluation in background |

## Spec & Planning Docs

- `dev-docs/spec.md` — Full technical specification
- `dev-docs/plan.md` — 8-phase implementation plan
- `dev-docs/progress.md` — Implementation log with task details and commit messages
- `dev-docs/key-learnings.md` — Conceptual learnings and insights by phase
