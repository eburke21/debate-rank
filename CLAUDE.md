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
uv run pytest tests/ -v          # Run all tests (19: 17 schema + 2 DB integration)
uv run pytest tests/test_schemas.py -v    # Schema validation tests only
uv run pytest tests/test_database.py -v   # DB integration tests only (requires running Postgres)
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
- **Ruff excludes:** `alembic/versions/` is excluded from linting (auto-generated migration code).

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
    main.py            # FastAPI app, CORS, routes
    database.py        # Async engine, session factory, Base, get_db dependency
    models/            # SQLAlchemy models (Topic, Argument, Score) + barrel __init__.py
    schemas/           # Pydantic request/response models + enums + barrel __init__.py
    api/               # Route handlers (arguments, topics, health)
    services/          # Business logic (judge orchestration, scoring)
    middleware/        # Rate limiting
  alembic/
    env.py             # Customized: swaps asyncpg→psycopg2, imports Base from app.models
    versions/          # Auto-generated migration files (excluded from ruff)
  tests/
    conftest.py        # db_session fixture (transaction rollback pattern)
    test_schemas.py    # 17 Pydantic validation tests
    test_database.py   # 2 integration tests (insert chain, cascade delete)

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

## Spec & Planning Docs

- `dev-docs/spec.md` — Full technical specification
- `dev-docs/plan.md` — 8-phase implementation plan
- `dev-docs/progress.md` — Implementation log with task details and commit messages
- `dev-docs/key-learnings.md` — Conceptual learnings and insights by phase
