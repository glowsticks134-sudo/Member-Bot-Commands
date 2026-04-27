FROM python:3.11-slim

WORKDIR /app

# Install uv for fast dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files first for layer caching
COPY pyproject.toml uv.lock ./

# Install dependencies (frozen = use lockfile exactly)
RUN uv sync --frozen --no-dev --no-install-project

# Copy application code
COPY gecko/ ./gecko/

# Create data directory for file-based storage
RUN mkdir -p /app/artifacts/data

ENV PORT=8080
EXPOSE 8080

CMD ["uv", "run", "python", "-m", "gecko"]
