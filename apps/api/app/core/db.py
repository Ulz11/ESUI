"""Async DB engine, session factory, Base class, and FastAPI dependency."""

from collections.abc import AsyncIterator
from datetime import datetime
from typing import Annotated
from uuid import UUID, uuid4

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID as PgUUID  # noqa: N811
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, mapped_column

from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=10,
)

SessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


# Common column type aliases — used across models for brevity.
uuid_pk = Annotated[
    UUID,
    mapped_column(PgUUID(as_uuid=True), primary_key=True, default=uuid4),
]
uuid_fk = Annotated[UUID, mapped_column(PgUUID(as_uuid=True))]
created_ts = Annotated[
    datetime,
    mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False),
]
nullable_ts = Annotated[
    datetime | None,
    mapped_column(DateTime(timezone=True), nullable=True),
]


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency. Routes commit explicitly; rollback on exception."""
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
