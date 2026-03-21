# Architecture Decision Records

## ADR-001: Client-Side Ranking Recomputation

### Context

Users adjust weight sliders to rebalance how much each rubric (Logic, Evidence, Persuasion, Originality) contributes to the composite score. This triggers a re-sort of the leaderboard. The question is where to compute the weighted average and sort: client-side or server-side.

### Decision

Weight slider changes recompute rankings entirely on the client. The API returns all arguments with their 4 individual rubric scores as a flat `dict[rubric, int]`. The frontend computes weighted composites using `computeComposite()` and sorts via `useMemo`.

### Consequences

- **Instant feedback:** No network latency on slider drag — re-sort happens in < 1ms for 12–100 arguments.
- **No API traffic:** Slider interactions produce zero HTTP requests.
- **Scores are immutable:** Once an argument is scored, its rubric scores never change, so there's no stale data risk.
- **Scale limitation:** If the leaderboard grew to 10,000+ arguments, client-side sort might become noticeable. At that scale, a server-side endpoint with weight params and pagination would be warranted.

### Alternatives Considered

- **Server-side ranking endpoint** (`GET /api/arguments?logic_weight=40&...`) — Rejected because slider interaction must feel instant (< 16ms frame budget), and it would generate excessive API traffic (one request per slider tick).
- **WebSocket push** — Overkill for a read-heavy, single-user interaction pattern.

---

## ADR-002: Parallel Judge Dispatch with Partial Failure Handling

### Context

Each submitted argument needs to be evaluated by 4 independent AI judges. LLM API calls have variable latency (1–10 seconds) and occasional failures (rate limits, timeouts, malformed output).

### Decision

All 4 judge calls are dispatched via `asyncio.gather(*tasks, return_exceptions=True)`. Results are processed individually: successful scores are persisted, failures are logged. The argument's status is set based on success count:
- 4/4 → `scored`
- 2–3/4 → `partial`
- 0–1/4 → `failed`

The composite score is the mean of successful scores (or `None` if failed).

### Consequences

- **4x faster than sequential:** All judges run concurrently — total time is the slowest judge, not the sum.
- **Graceful degradation:** A single judge timeout doesn't block the other 3 scores from being displayed.
- **Complexity tradeoff:** The `partial` status adds a third state to handle in both backend and frontend. The frontend dims pending judge cards and shows a "Partial evaluation" badge.
- **No retry mechanism (MVP):** Failed judges are not automatically retried. A future iteration could add a background retry worker.

### Alternatives Considered

- **Sequential evaluation** — Simpler, but 4x the latency. Rejected for UX reasons.
- **All-or-nothing with full retry** — User waits too long on failure. Rejected.
- **Fire-and-forget with eventual consistency** — Would require WebSocket or SSE for push notifications. Deferred to a future phase.

---

## ADR-003: PostgreSQL over SQLite

### Context

The application needs to persist debate topics, arguments, and scores. Scores arrive concurrently from parallel judge dispatch (4 INSERT operations within a few seconds).

### Decision

PostgreSQL 16 via `asyncpg` + SQLAlchemy async, containerized with Docker Compose.

### Consequences

- **Concurrent writes:** PostgreSQL handles 4 simultaneous score INSERTs without locking issues. SQLite's write lock would serialize them.
- **ACID transactions:** Score persistence uses a single transaction — all 4 scores commit atomically (or roll back on error).
- **Docker dependency:** Requires Docker for local development. Mitigated by Docker Compose one-command setup.
- **Async driver:** `asyncpg` is a native async PostgreSQL driver — no connection pool blocking. Pairs naturally with FastAPI's async request handlers.
- **Future-ready:** Advisory locks available for future ELO/ranking implementations. JSONB columns available for flexible metadata storage.

### Alternatives Considered

- **SQLite** — Simpler setup (no Docker), but concurrent writes are limited by the WAL write lock. Would work for a single-user demo but misrepresents the architectural intent.
- **In-memory store** — No persistence across restarts. Rejected.

---

## ADR-004: Structured JSON Output with Retry

### Context

Each judge returns a score (1–10 integer) and a rationale (string). The LLM output needs to be parsed reliably into these typed fields.

### Decision

Judge prompts explicitly request JSON output with a specified schema. Responses are parsed with `json.loads()` + Pydantic `model_validate()`. On parse failure, a correction prompt is sent once, including the error message and the original response. Two consecutive failures raise a `ValueError`.

### Consequences

- **Reliable parsing:** JSON output from Claude is well-formed 98%+ of the time. The correction prompt recovers most of the remaining 2%.
- **Type safety:** Pydantic validation ensures the score is an integer in [1, 10] and the rationale is a non-empty string.
- **Retry cost:** One retry doubles the token cost for that judge call (~$0.01 extra). Acceptable for the reliability gain.
- **No infinite retry loop:** Hard limit of 2 attempts per judge prevents runaway API costs.

### Alternatives Considered

- **Claude tool use / function calling** — Viable and increasingly reliable, but adds complexity for a scoring-only use case. The JSON prompt approach is simpler and sufficient.
- **Free text + regex parsing** — Fragile. A score embedded in a sentence ("I'd give this a 7 out of 10") requires complex extraction. Rejected.
- **Claude's native structured output mode** — At the time of implementation, the explicit JSON prompt with retry was the most battle-tested pattern.
