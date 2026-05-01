"""Tasks — calendar + task management surface inside Vault.

Two shapes share the same row:
  - kind='task'   a todo, optional due date via starts_at
  - kind='event'  a scheduled block, starts_at + ends_at (all_day for date-only)

Sharing model: shared=true makes the row visible to the partner.
Otherwise private to owner.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import desc, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_user
from app.core.db import get_session
from app.core.errors import bad_request, not_found
from app.models import Task, User

router = APIRouter(prefix="/tasks", tags=["tasks"])


# ---------- schemas ----------


TaskKind = Literal["task", "event"]
TaskStatus = Literal["pending", "in_progress", "done", "cancelled"]


class TaskOut(BaseModel):
    id: str
    owner_id: str
    kind: TaskKind
    title: str
    description: str | None
    status: TaskStatus
    starts_at: datetime | None
    ends_at: datetime | None
    all_day: bool
    color: str | None
    shared: bool
    recurrence_rule: str | None
    location: str | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class TaskCreate(BaseModel):
    kind: TaskKind = "task"
    title: str = Field(..., min_length=1)
    description: str | None = None
    status: TaskStatus = "pending"
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    all_day: bool = False
    color: str | None = None
    shared: bool = False
    recurrence_rule: str | None = None
    location: str | None = None


class TaskPatch(BaseModel):
    kind: TaskKind | None = None
    title: str | None = None
    description: str | None = None
    status: TaskStatus | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    all_day: bool | None = None
    color: str | None = None
    shared: bool | None = None
    recurrence_rule: str | None = None
    location: str | None = None
    archived: bool | None = None


def _t_out(t: Task) -> TaskOut:
    return TaskOut(
        id=str(t.id),
        owner_id=str(t.owner_id),
        kind=t.kind,  # type: ignore[arg-type]
        title=t.title,
        description=t.description,
        status=t.status,  # type: ignore[arg-type]
        starts_at=t.starts_at,
        ends_at=t.ends_at,
        all_day=t.all_day,
        color=t.color,
        shared=t.shared,
        recurrence_rule=t.recurrence_rule,
        location=t.location,
        completed_at=t.completed_at,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


async def _partner_id(session: AsyncSession, user: User) -> UUID | None:
    other = await session.execute(
        select(User.id).where(User.id != user.id).limit(1)
    )
    return other.scalar_one_or_none()


def _visibility(owner_id: UUID, partner_id: UUID | None):
    """Either I own it OR partner owns + shared=true."""
    if partner_id is None:
        return Task.owner_id == owner_id
    return or_(
        Task.owner_id == owner_id,
        (Task.owner_id == partner_id) & (Task.shared.is_(True)),
    )


# ---------- list / range / today ----------


@router.get("", response_model=list[TaskOut])
async def list_tasks(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
    *,
    kind: TaskKind | None = None,
    status: TaskStatus | None = None,
    range_from: datetime | None = None,
    range_to: datetime | None = None,
    include_archived: bool = False,
    include_done: bool = True,
    limit: int = 500,
) -> list[TaskOut]:
    partner = await _partner_id(session, user)
    q = select(Task).where(_visibility(user.id, partner))

    if not include_archived:
        q = q.where(Task.archived_at.is_(None))
    if not include_done:
        q = q.where(Task.status != "done")
    if kind is not None:
        q = q.where(Task.kind == kind)
    if status is not None:
        q = q.where(Task.status == status)
    if range_from is not None:
        # Include rows whose ends_at (or starts_at when ends_at is null) is >= range_from
        q = q.where(
            or_(
                Task.ends_at.is_not(None) & (Task.ends_at >= range_from),
                Task.ends_at.is_(None) & (Task.starts_at.is_not(None)) & (Task.starts_at >= range_from),
            )
        )
    if range_to is not None:
        q = q.where(
            or_(
                Task.starts_at.is_(None),
                Task.starts_at <= range_to,
            )
        )
    q = q.order_by(Task.starts_at.asc().nullslast(), desc(Task.created_at)).limit(min(limit, 1000))
    rows = await session.execute(q)
    return [_t_out(t) for t in rows.scalars().all()]


@router.get("/today", response_model=list[TaskOut])
async def today_tasks(
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> list[TaskOut]:
    """Convenience: tasks/events touching the next 24h, plus undated open todos."""
    now = datetime.now(tz=timezone.utc)
    end = now.replace(hour=23, minute=59, second=59, microsecond=0)
    partner = await _partner_id(session, user)
    q = (
        select(Task)
        .where(_visibility(user.id, partner))
        .where(Task.archived_at.is_(None))
        .where(Task.status != "cancelled")
        .where(
            or_(
                Task.starts_at.is_(None),  # open todos with no due date
                (Task.starts_at <= end) & (
                    (Task.ends_at.is_(None)) | (Task.ends_at >= now)
                ),
            )
        )
        .order_by(Task.starts_at.asc().nullslast())
    )
    rows = await session.execute(q)
    return [_t_out(t) for t in rows.scalars().all()]


# ---------- CRUD ----------


@router.post("", response_model=TaskOut, status_code=201)
async def create_task(
    body: TaskCreate,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskOut:
    if body.kind == "event" and body.starts_at is None:
        raise bad_request("event must have starts_at")
    if body.ends_at and body.starts_at and body.ends_at < body.starts_at:
        raise bad_request("ends_at must be >= starts_at")

    t = Task(
        owner_id=user.id,
        kind=body.kind,
        title=body.title.strip(),
        description=body.description,
        status=body.status,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        all_day=body.all_day,
        color=body.color,
        shared=body.shared,
        recurrence_rule=body.recurrence_rule,
        location=body.location,
    )
    session.add(t)
    await session.commit()
    return _t_out(t)


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(
    task_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskOut:
    t = await session.get(Task, task_id)
    if t is None:
        raise not_found("task")
    partner = await _partner_id(session, user)
    if t.owner_id != user.id and not (t.shared and t.owner_id == partner):
        raise not_found("task")
    return _t_out(t)


@router.patch("/{task_id}", response_model=TaskOut)
async def patch_task(
    task_id: UUID,
    body: TaskPatch,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskOut:
    t = await session.get(Task, task_id)
    if t is None or t.owner_id != user.id:
        raise not_found("task")
    data = body.model_dump(exclude_unset=True)
    archived = data.pop("archived", None)
    if archived is True:
        t.archived_at = datetime.now(tz=timezone.utc)
    elif archived is False:
        t.archived_at = None
    for k, v in data.items():
        setattr(t, k, v)
    if "status" in data and data["status"] == "done" and t.completed_at is None:
        t.completed_at = datetime.now(tz=timezone.utc)
    if "status" in data and data["status"] != "done":
        t.completed_at = None
    t.updated_at = datetime.now(tz=timezone.utc)
    await session.commit()
    return _t_out(t)


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    t = await session.get(Task, task_id)
    if t is None or t.owner_id != user.id:
        raise not_found("task")
    await session.delete(t)
    await session.commit()


# ---------- quick toggles ----------


@router.post("/{task_id}/complete", response_model=TaskOut)
async def complete_task(
    task_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskOut:
    t = await session.get(Task, task_id)
    if t is None or t.owner_id != user.id:
        raise not_found("task")
    t.status = "done"
    t.completed_at = datetime.now(tz=timezone.utc)
    t.updated_at = t.completed_at
    await session.commit()
    return _t_out(t)


@router.post("/{task_id}/uncomplete", response_model=TaskOut)
async def uncomplete_task(
    task_id: UUID,
    user: User = Depends(current_user),
    session: AsyncSession = Depends(get_session),
) -> TaskOut:
    t = await session.get(Task, task_id)
    if t is None or t.owner_id != user.id:
        raise not_found("task")
    t.status = "pending"
    t.completed_at = None
    t.updated_at = datetime.now(tz=timezone.utc)
    await session.commit()
    return _t_out(t)
