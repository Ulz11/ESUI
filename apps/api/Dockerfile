# ESUI API — production Docker image (uv + python 3.12)
FROM python:3.12-slim-bookworm AS base

# System deps for asyncpg, Pillow, etc.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        ca-certificates \
        libpq5 \
        libjpeg62-turbo \
        libpng16-16 \
        zlib1g \
 && rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package manager)
COPY --from=ghcr.io/astral-sh/uv:0.5.4 /uv /uvx /usr/local/bin/

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# Install deps first for layer caching.
COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-install-project --no-dev || uv sync --no-install-project --no-dev

COPY . .

# Install the project itself
RUN uv sync --frozen --no-dev || uv sync --no-dev

EXPOSE 8000

# uv run launches uvicorn with the venv on PATH.
CMD ["uv", "run", "uvicorn", "app.main:asgi", \
     "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "1", \
     "--proxy-headers", "--forwarded-allow-ips", "*"]
