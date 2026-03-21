FROM python:3.12-slim

WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files first for layer caching
COPY pyproject.toml uv.lock ./

# Install dependencies (system-wide, no venv in container)
RUN uv sync --frozen --no-dev --no-install-project

# Copy application source
COPY . .

# Railway provides $PORT; default to 8000 for local Docker
ENV PORT=8000

# Run migrations then start server
CMD sh -c "uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT"
