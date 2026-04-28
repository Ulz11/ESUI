"""ESUI API entrypoint.

Mounts FastAPI under a Socket.io ASGI app so REST and WebSocket share one
process. The combined ASGI callable is `asgi`.

Run:
  uv run uvicorn app.main:asgi --reload --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.log import configure_logging, log
from app.core.redis import close_redis
from app.jobs.scheduler import start_scheduler, stop_scheduler

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    log.info("api.startup", env=settings.app_env)
    start_scheduler()  # in-process; for multi-machine deploys, run a beat sidecar
    try:
        yield
    finally:
        stop_scheduler()
        await close_redis()
        log.info("api.shutdown")


app = FastAPI(title="ESUI API", version="0.0.1", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/healthz")
async def healthz() -> dict[str, object]:
    return {"ok": True, "env": settings.app_env}


# ---------- Socket.io ----------
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.allowed_origins,
    logger=False,
    engineio_logger=False,
)

# ---------- Routers ----------
# Imported AFTER app is defined to avoid circular imports during module load.
from app.widgets.auth import router as auth_router  # noqa: E402
from app.widgets.chat import router as chat_router  # noqa: E402
from app.widgets.exam import router as exam_router  # noqa: E402
from app.widgets.files import router as files_router  # noqa: E402
from app.widgets.me import router as me_router  # noqa: E402
from app.widgets.memory import router as memory_router  # noqa: E402
from app.widgets.signals import router as signals_router  # noqa: E402
from app.widgets.together import router as together_router  # noqa: E402
from app.widgets.vault import router as vault_router  # noqa: E402

app.include_router(auth_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(files_router, prefix="/api/v1")
app.include_router(vault_router, prefix="/api/v1")
app.include_router(exam_router, prefix="/api/v1")
app.include_router(together_router, prefix="/api/v1")
app.include_router(signals_router, prefix="/api/v1")
app.include_router(memory_router, prefix="/api/v1")
app.include_router(me_router, prefix="/api/v1")


# ---------- Realtime handlers ----------
# Importing the module registers @sio.event handlers via decorators.
import app.realtime.server  # noqa: E402, F401


# ---------- Combined ASGI ----------
asgi = socketio.ASGIApp(sio, other_asgi_app=app)
