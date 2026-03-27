# ⚖️DebateRank

Multi-criteria LLM-as-judge evaluation platform. Submit debate arguments, 4 AI judges (Logic, Evidence, Persuasion, Originality) score each on a 1–10 rubric with written rationales, and a live leaderboard re-ranks in real time as you adjust weight sliders. React + FastAPI + PostgreSQL.

![DebateRank](frontend/public/debate-rank.png)

## What It Does

DebateRank lets users submit debate arguments that are evaluated by 4 independent AI judges — **Logic**, **Evidence**, **Persuasion**, and **Originality** — each scoring from 1 to 10 with written rationales. A leaderboard ranks all arguments using configurable weight sliders that recompute rankings instantly on the client.

## Why It Exists

This project demonstrates **LLM-as-judge evaluation infrastructure** — a pattern increasingly used in production for content moderation, RAG quality scoring, and automated grading. It shows how to orchestrate parallel AI evaluations with partial failure handling, structured output parsing with retry, and real-time client-side reranking.

## Architecture

```mermaid
graph TD
    subgraph Frontend ["Frontend (React + TypeScript)"]
        A["Leaderboard View"]
        B["Weight Sliders"]
        C["Argument Detail / Transparency Panel"]
        D["Submit Argument Modal"]
    end

    subgraph Backend ["Backend (FastAPI)"]
        E["POST /api/arguments"]
        F["GET /api/arguments"]
        G["GET /api/arguments/{id}"]
        H["GET /api/topics"]
        I["Judge Orchestrator"]
    end

    subgraph LLM ["Anthropic Claude API"]
        J["Judge: Logic"]
        K["Judge: Evidence"]
        L["Judge: Persuasion"]
        M["Judge: Originality"]
    end

    subgraph DB ["PostgreSQL"]
        N["topics"]
        O["arguments"]
        P["scores"]
    end

    D -->|"submit text"| E
    E -->|"dispatch 4 judges"| I
    I -->|"parallel async"| J & K & L & M
    J & K & L & M -->|"score + rationale"| I
    I -->|"persist scores"| P
    E -->|"persist argument"| O

    A -->|"fetch ranked list"| F
    C -->|"fetch detail + scores"| G
    F -->|"query"| O
    G -->|"query"| O & P

    B -->|"client-side reweight"| A
```

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 19, TypeScript, Chakra UI v3, Recharts | Responsive UI with animated leaderboard, radar charts, dark mode |
| Backend | FastAPI, SQLAlchemy 2.0 (async), Pydantic v2 | Async API with structured validation and auto OpenAPI docs |
| Database | PostgreSQL 16, asyncpg | Concurrent writes, ACID transactions for parallel score persistence |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) | 4 independent judge evaluations with structured JSON output |
| Infra | Docker Compose, Alembic, GitHub Actions CI | One-command setup, schema migrations, automated testing |

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- An [Anthropic API key](https://console.anthropic.com/) (for judge evaluations)

### Setup

```bash
# Clone
git clone https://github.com/yourusername/debate-rank.git
cd debate-rank

# Configure
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Start everything
docker compose up --build

# In a separate terminal, seed the database with sample arguments
cd backend
DATABASE_URL=postgresql+asyncpg://debaterank:localdev@localhost:5432/debaterank \
  uv run python -m scripts.seed
```

Open [http://localhost:5173](http://localhost:5173) to see the leaderboard.

### Seed Options

```bash
# Preview seed data without making any changes
uv run python -m scripts.seed --dry-run

# Insert arguments without LLM evaluation (no API key needed)
uv run python -m scripts.seed --skip-evaluation

# Reset all data and re-seed
uv run python -m scripts.seed --reset
```

## Key Engineering Decisions

**Client-side ranking recomputation** — Weight slider changes recompute rankings entirely on the client. The API returns all arguments with their 4 individual rubric scores; the frontend computes weighted composites and sorts. With ≤100 arguments, client-side sort is instantaneous and eliminates API round-trips on every slider drag.

**Parallel judge dispatch with partial failure** — All 4 judge calls dispatch via `asyncio.gather(return_exceptions=True)`. If 1–2 judges fail, the argument is saved with partial scores and a `partial` status flag. Partial results are more useful than no results.

**Structured JSON output with retry** — Judge prompts request JSON output, parsed with Pydantic `model_validate_json()`. On parse failure, a correction prompt (including the error and original response) is sent once. Two consecutive failures raise an error.

**PostgreSQL over SQLite** — Concurrent writes from judge results landing at different times require proper ACID transactions. PostgreSQL also provides advisory locks for future ELO implementation and signals stack breadth in the portfolio.

## API Documentation

The backend serves interactive API docs at:
- **Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/topics/active` | Get the active debate topic |
| `GET` | `/api/arguments?topic_id=` | Leaderboard — scored arguments with rubric scores |
| `GET` | `/api/arguments/{id}` | Argument detail with judge rationales |
| `POST` | `/api/arguments` | Submit argument for evaluation (returns 202) |

## Project Structure

```
backend/
  app/
    main.py              # FastAPI app, CORS, middleware, exception handler
    config.py            # pydantic-settings (DATABASE_URL, ANTHROPIC_API_KEY)
    database.py          # Async engine, session factory, get_db dependency
    models/              # SQLAlchemy models: Topic, Argument, Score
    schemas/             # Pydantic request/response models, enums, error envelope
    api/                 # Route handlers: health, topics, arguments
    services/            # judge.py (LLM evaluation), sanitization.py, scoring.py
    middleware/          # IP-based rate limiting
  scripts/seed.py        # Seed pipeline with --dry-run, --reset, --skip-evaluation
  alembic/               # Database migrations
  tests/                 # 58 tests: schemas, sanitization, scoring, database, API, judge

frontend/src/
  theme/index.ts         # Chakra UI v3 system + rubric color tokens
  api/client.ts          # Axios client with error toast interceptor
  types/index.ts         # TypeScript types mirroring backend schemas
  hooks/
    useWeights.ts        # Weight redistribution + weighted composite scoring
    useLeaderboard.ts    # Topic + arguments data fetching
    useArgumentPolling.ts # Polling for scoring progress (useReducer pattern)
    useColorMode.ts      # Dark/light mode with localStorage persistence
  components/
    TopicHeader.tsx      # Topic title, description, argument count
    WeightSliderPanel.tsx # 4 weight sliders + reset + distribution bar
    Leaderboard.tsx      # Weighted sort, animated reordering, loading skeletons
    LeaderboardRow.tsx   # Rank badge, body preview, mini score bars
    ArgumentDetailDrawer.tsx # Full text, radar chart, judge cards
    SubmitArgumentModal.tsx  # 3-phase state machine: drafting → scoring → complete
    ScoreRadarChart.tsx  # Recharts radar chart with 4 rubric axes
    JudgeCard.tsx        # Score display with collapsible rationale
    ScoringProgress.tsx  # 4 judge progress indicators with animations
```

## Development

### Backend

```bash
cd backend
uv sync                          # Install dependencies
uv run uvicorn app.main:app --reload  # Run dev server
uv run ruff check .              # Lint
uv run ruff format .             # Format
uv run pytest tests/ -v          # Run tests (requires running Postgres)
```

### Frontend

```bash
cd frontend
npm install                      # Install dependencies
npm run dev                      # Run dev server (port 5173)
npm run build                    # Type-check + build
npm run lint                     # ESLint
npm test                         # Run unit tests (Vitest)
```

### Running Everything with Docker

```bash
docker compose up --build        # Start db + backend + frontend
```

- Backend: http://localhost:8000
- Frontend: http://localhost:5173
- PostgreSQL: localhost:5432

## Testing

| Suite | Count | Command |
|---|---|---|
| Backend (pytest) | 58 | `cd backend && uv run pytest tests/ -v` |
| Frontend (Vitest) | 15 | `cd frontend && npm test` |
| **Total** | **73** | |

## License

MIT
