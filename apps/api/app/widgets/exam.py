"""Exam widget — workspaces, sources, artifact generation, attempts.

Drop-to-files flow:
  POST /exam/workspaces/{ws_id}/ingest  — paste text or upload file_ids;
       creates summary + flashcard_deck artifacts in parallel.

Flashcard review (TOK-card-style RNN scheduler):
  POST /exam/flashcards/{artifact_id}/review {card_idx, signal}

Other artifact kinds: cheatsheet, practice_set, concept_map, knowledge_graph,
simulation. All generation endpoints share /workspaces/{ws_id}/generate.
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_esui
from app.core.db import SessionLocal, get_session
from app.core.errors import bad_request, not_found
from app.core.log import log
from app.models import (
    AICall,
    ExamArtifact,
    ExamAttempt,
    ExamSource,
    ExamWorkspace,
    File,
    User,
)
from app.orchestrator.exam_gen import (
    collect_workspace_text,
    generate_cheatsheet,
    generate_concept_map,
    generate_flashcards,
    generate_knowledge_graph,
    generate_practice_set,
    generate_simulation,
    generate_summary,
    grade_attempt,
)
from app.orchestrator.router import select as select_route

router = APIRouter(prefix="/exam", tags=["exam"])


# ---------- schemas ----------


class WorkspaceOut(BaseModel):
    id: str
    title: str
    subject: str | None
    created_at: datetime
    updated_at: datetime


class WorkspaceCreate(BaseModel):
    title: str
    subject: str | None = None


class SourceOut(BaseModel):
    id: str
    workspace_id: str
    file_id: str
    added_at: datetime


class ArtifactOut(BaseModel):
    id: str
    workspace_id: str
    kind: str
    title: str
    payload: dict[str, Any]
    status: str
    error: str | None
    generated_in_mode: str | None
    generated_by_model: str | None
    created_at: datetime


class GenerateRequest(BaseModel):
    kind: str  # 'cheatsheet' | 'practice_set'
    mode: str = "ulzii"
    title: str | None = None
    options: dict[str, Any] = {}


class AttemptCreate(BaseModel):
    responses: dict[str, Any]
    duration_sec: int | None = None


class AttemptOut(BaseModel):
    id: str
    artifact_id: str
    score: float | None
    weak_topics: list[Any] | None
    duration_sec: int | None
    completed_at: datetime | None
    created_at: datetime


def _ws_out(w: ExamWorkspace) -> WorkspaceOut:
    return WorkspaceOut(
        id=str(w.id), title=w.title, subject=w.subject,
        created_at=w.created_at, updated_at=w.updated_at,
    )


def _src_out(s: ExamSource) -> SourceOut:
    return SourceOut(
        id=str(s.id), workspace_id=str(s.workspace_id),
        file_id=str(s.file_id), added_at=s.added_at,
    )


def _art_out(a: ExamArtifact) -> ArtifactOut:
    return ArtifactOut(
        id=str(a.id),
        workspace_id=str(a.workspace_id),
        kind=a.kind,
        title=a.title,
        payload=a.payload,
        status=a.status,
        error=a.error,
        generated_in_mode=a.generated_in_mode,
        generated_by_model=a.generated_by_model,
        created_at=a.created_at,
    )


async def _ensure_owner(
    session: AsyncSession, ws_id: UUID, user_id: UUID
) -> ExamWorkspace:
    w = await session.get(ExamWorkspace, ws_id)
    if w is None or w.owner_id != user_id:
        raise not_found("workspace")
    return w


# ---------- workspaces ----------


@router.get("/workspaces", response_model=list[WorkspaceOut])
async def list_workspaces(
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
    limit: int = 50,
) -> list[WorkspaceOut]:
    rows = await session.execute(
        select(ExamWorkspace)
        .where(ExamWorkspace.owner_id == user.id)
        .order_by(desc(ExamWorkspace.updated_at))
        .limit(min(limit, 200))
    )
    return [_ws_out(w) for w in rows.scalars().all()]


@router.post("/workspaces", response_model=WorkspaceOut, status_code=201)
async def create_workspace(
    body: WorkspaceCreate,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> WorkspaceOut:
    w = ExamWorkspace(owner_id=user.id, title=body.title, subject=body.subject)
    session.add(w)
    await session.commit()
    return _ws_out(w)


@router.get("/workspaces/{ws_id}", response_model=WorkspaceOut)
async def get_workspace(
    ws_id: UUID,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> WorkspaceOut:
    w = await _ensure_owner(session, ws_id, user.id)
    return _ws_out(w)


@router.delete("/workspaces/{ws_id}", status_code=204)
async def delete_workspace(
    ws_id: UUID,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> None:
    w = await _ensure_owner(session, ws_id, user.id)
    await session.delete(w)
    await session.commit()


# ---------- sources ----------


@router.get("/workspaces/{ws_id}/sources", response_model=list[SourceOut])
async def list_sources(
    ws_id: UUID,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> list[SourceOut]:
    await _ensure_owner(session, ws_id, user.id)
    rows = await session.execute(
        select(ExamSource).where(ExamSource.workspace_id == ws_id)
    )
    return [_src_out(s) for s in rows.scalars().all()]


@router.post("/workspaces/{ws_id}/sources", response_model=SourceOut, status_code=201)
async def add_source(
    ws_id: UUID,
    body: dict[str, str],
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> SourceOut:
    await _ensure_owner(session, ws_id, user.id)
    file_id = UUID(body["file_id"])
    f = await session.get(File, file_id)
    if f is None or f.owner_id != user.id:
        raise not_found("file")

    src = ExamSource(workspace_id=ws_id, file_id=file_id)
    session.add(src)
    await session.commit()

    # Trigger ingest if not already done.
    from app.ingest.parse import ingest_file
    asyncio.create_task(ingest_file(file_id=file_id, target="file_chunks"))
    return _src_out(src)


# ---------- generate ----------


@router.get("/workspaces/{ws_id}/artifacts", response_model=list[ArtifactOut])
async def list_artifacts(
    ws_id: UUID,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> list[ArtifactOut]:
    await _ensure_owner(session, ws_id, user.id)
    rows = await session.execute(
        select(ExamArtifact)
        .where(ExamArtifact.workspace_id == ws_id)
        .order_by(desc(ExamArtifact.created_at))
    )
    return [_art_out(a) for a in rows.scalars().all()]


@router.post("/workspaces/{ws_id}/generate", response_model=ArtifactOut, status_code=202)
async def generate_artifact(
    ws_id: UUID,
    body: GenerateRequest,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> ArtifactOut:
    await _ensure_owner(session, ws_id, user.id)
    if body.kind not in (
        "cheatsheet", "practice_set", "concept_map",
        "knowledge_graph", "simulation",
        "summary", "flashcard_deck",
    ):
        raise bad_request(f"unsupported kind: {body.kind}")

    artifact = ExamArtifact(
        id=uuid4(),
        workspace_id=ws_id,
        kind=body.kind,
        title=body.title or _default_title(body.kind),
        payload={},
        status="generating",
        generated_in_mode=body.mode,
    )
    session.add(artifact)
    await session.commit()

    asyncio.create_task(_run_generation(artifact.id, user.id, ws_id, body))
    return _art_out(artifact)


class IngestRequest(BaseModel):
    """Drop-to-files / paste flow."""
    text: str | None = None
    file_ids: list[str] = []
    mode: str = "ulzii"
    title_hint: str | None = None
    n_cards: int = 20


class IngestResponse(BaseModel):
    summary_artifact_id: str
    flashcard_artifact_id: str


@router.post("/workspaces/{ws_id}/ingest", response_model=IngestResponse, status_code=202)
async def ingest_workspace(
    ws_id: UUID,
    body: IngestRequest,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> IngestResponse:
    """Run summary + flashcard generation against pasted text or file_ids.

    The frontend's drop zone calls this with either:
    - `text`: text/markdown content read client-side, OR
    - `file_ids`: previously uploaded via /api/v1/files (PDFs, images, etc.).

    Both artifacts are created immediately as `status=generating` and the
    real work runs in background tasks. Poll /artifacts/{id} or listen on
    Socket.io `artifact:complete` for completion.
    """
    ws = await _ensure_owner(session, ws_id, user.id)

    if not body.text and not body.file_ids:
        raise bad_request("ingest needs either `text` or `file_ids`")

    # If file_ids supplied: register them as ExamSources (idempotent) and
    # trigger ingest. The worker will wait for chunks before generating.
    paste_text: str | None = body.text
    if body.file_ids:
        from app.ingest.parse import ingest_file as _ingest_file

        existing = (await session.execute(
            select(ExamSource).where(ExamSource.workspace_id == ws_id)
        )).scalars().all()
        existing_ids = {str(s.file_id) for s in existing}

        for fid in body.file_ids:
            if fid in existing_ids:
                continue
            try:
                file_uuid = UUID(fid)
            except ValueError as e:
                raise bad_request(f"bad file_id: {fid}") from e
            f = await session.get(File, file_uuid)
            if f is None or f.owner_id != user.id:
                raise not_found(f"file {fid}")
            session.add(ExamSource(workspace_id=ws_id, file_id=file_uuid))
        await session.commit()

        # Kick off ingest in the background — _run_generation polls for chunks.
        for fid in body.file_ids:
            asyncio.create_task(_ingest_file(file_id=UUID(fid), target="file_chunks"))

    # Two artifacts; both start in 'generating'.
    sum_art = ExamArtifact(
        id=uuid4(), workspace_id=ws_id, kind="summary",
        title=body.title_hint or f"Summary · {ws.title}",
        payload={}, status="generating", generated_in_mode=body.mode,
    )
    fc_art = ExamArtifact(
        id=uuid4(), workspace_id=ws_id, kind="flashcard_deck",
        title=body.title_hint or f"Flashcards · {ws.title}",
        payload={}, status="generating", generated_in_mode=body.mode,
    )
    session.add_all([sum_art, fc_art])
    await session.commit()

    sum_body = GenerateRequest(
        kind="summary", mode=body.mode,
        title=sum_art.title,
        options={"paste_text": paste_text} if paste_text else {},
    )
    fc_body = GenerateRequest(
        kind="flashcard_deck", mode=body.mode,
        title=fc_art.title,
        options={
            "paste_text": paste_text,
            "n_cards": body.n_cards,
        } if paste_text else {"n_cards": body.n_cards},
    )

    asyncio.create_task(_run_generation(sum_art.id, user.id, ws_id, sum_body))
    asyncio.create_task(_run_generation(fc_art.id, user.id, ws_id, fc_body))

    return IngestResponse(
        summary_artifact_id=str(sum_art.id),
        flashcard_artifact_id=str(fc_art.id),
    )


# ---------- flashcard review (RNN scheduler update) ----------


class FlashcardReviewRequest(BaseModel):
    card_idx: int
    # 0=again, 0.33=hard, 0.66=good, 1.0=easy — matches the TOK card.html scheme.
    signal: float


class FlashcardReviewResponse(BaseModel):
    card_idx: int
    h: float
    reviews: int
    streak: int
    last_review: datetime


@router.post(
    "/flashcards/{artifact_id}/review",
    response_model=FlashcardReviewResponse,
)
async def review_flashcard(
    artifact_id: UUID,
    body: FlashcardReviewRequest,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> FlashcardReviewResponse:
    """Update RNN scheduler state for one card.

    State per card: { h, last_review, reviews, streak } stored inside
    artifact.payload.review_state[str(card_idx)]. The scheduler is the
    one from the TOK card.html reference: a sigmoid-wrapped recurrent
    update with exponential time decay.
    """
    a = await session.get(ExamArtifact, artifact_id)
    if a is None or a.kind != "flashcard_deck":
        raise not_found("flashcard deck")
    w = await session.get(ExamWorkspace, a.workspace_id)
    if w is None or w.owner_id != user.id:
        raise not_found("flashcard deck")

    payload = dict(a.payload or {})
    cards = payload.get("cards", [])
    if not (0 <= body.card_idx < len(cards)):
        raise bad_request("card_idx out of range")
    if not (0.0 <= body.signal <= 1.0):
        raise bad_request("signal must be in [0,1]")

    state = dict(payload.get("review_state") or {})
    key = str(body.card_idx)
    s = dict(state.get(key) or {"h": 0.1, "last_review": None, "reviews": 0, "streak": 0})

    new_state = _rnn_update(s, body.signal, datetime.now())
    state[key] = new_state
    payload["review_state"] = state
    a.payload = payload
    # Force JSONB column re-flush — SQLA tracks dict identity, not contents.
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(a, "payload")
    await session.commit()

    return FlashcardReviewResponse(
        card_idx=body.card_idx,
        h=new_state["h"],
        reviews=new_state["reviews"],
        streak=new_state["streak"],
        last_review=datetime.fromisoformat(new_state["last_review"]),
    )


def _rnn_update(s: dict[str, Any], signal: float, now: datetime) -> dict[str, Any]:
    """Port of TOK card.html RNNScheduler.update — keeps clients and server in sync.

    h(t+1) = sigmoid( ( w_decay * h(t) * decay(Δt) + w_input * signal ) * 5 - 2 )
    """
    import math

    w_decay = 0.85
    w_input = 0.4
    decay_rate = 0.03  # per hour

    last_iso = s.get("last_review")
    if last_iso:
        try:
            last = datetime.fromisoformat(last_iso)
            dt_hours = max(0.0, (now - last).total_seconds() / 3600.0)
        except Exception:
            dt_hours = 0.0
    else:
        dt_hours = 0.0

    decay = math.exp(-decay_rate * dt_hours)
    current_h = 1 / (1 + math.exp(-(((w_decay * float(s.get("h", 0.1))) * decay) * 6 - 3)))

    recurrence = w_decay * current_h
    inp = w_input * float(signal)
    new_h = 1 / (1 + math.exp(-((recurrence + inp) * 5 - 2)))

    streak = int(s.get("streak", 0))
    streak = streak + 1 if signal >= 0.5 else 0
    if streak > 2:
        new_h = min(1.0, new_h + 0.05)

    return {
        "h": float(new_h),
        "last_review": now.isoformat(),
        "reviews": int(s.get("reviews", 0)) + 1,
        "streak": streak,
    }


@router.get("/artifacts/{artifact_id}", response_model=ArtifactOut)
async def get_artifact(
    artifact_id: UUID,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> ArtifactOut:
    a = await session.get(ExamArtifact, artifact_id)
    if a is None:
        raise not_found("artifact")
    w = await session.get(ExamWorkspace, a.workspace_id)
    if w is None or w.owner_id != user.id:
        raise not_found("artifact")
    return _art_out(a)


# ---------- attempts ----------


@router.post("/artifacts/{artifact_id}/attempt", response_model=AttemptOut, status_code=201)
async def create_attempt(
    artifact_id: UUID,
    body: AttemptCreate,
    user: User = Depends(require_esui),
    session: AsyncSession = Depends(get_session),
) -> AttemptOut:
    a = await session.get(ExamArtifact, artifact_id)
    if a is None:
        raise not_found("artifact")
    w = await session.get(ExamWorkspace, a.workspace_id)
    if w is None or w.owner_id != user.id:
        raise not_found("artifact")

    attempt = ExamAttempt(
        artifact_id=artifact_id,
        user_id=user.id,
        responses=body.responses,
        duration_sec=body.duration_sec,
        completed_at=datetime.now(),
    )
    session.add(attempt)
    await session.commit()

    # AI grading runs synchronously for fast feedback (typically <8s on Sonnet).
    if a.kind in ("practice_set", "simulation"):
        try:
            grade = await grade_attempt(
                artifact_payload=a.payload,
                responses=body.responses,
                duration_sec=body.duration_sec,
            )
            attempt.score = float(grade.get("score", 0))
            attempt.weak_topics = grade.get("weak_topics", [])
            tokens_in = grade.pop("tokens_in", None)
            tokens_out = grade.pop("tokens_out", None)
            session.add(AICall(
                user_id=user.id,
                task="exam.grade",
                provider="anthropic",
                model_id="claude-sonnet",
                tokens_in=tokens_in,
                tokens_out=tokens_out,
            ))
            await session.commit()
        except Exception:
            log.exception("exam.grade.error", attempt_id=str(attempt.id))

    return AttemptOut(
        id=str(attempt.id),
        artifact_id=str(attempt.artifact_id),
        score=attempt.score,
        weak_topics=attempt.weak_topics,
        duration_sec=attempt.duration_sec,
        completed_at=attempt.completed_at,
        created_at=attempt.created_at,
    )


# ---------- helpers ----------


def _default_title(kind: str) -> str:
    return {
        "cheatsheet": "Cheatsheet",
        "practice_set": "Practice",
        "concept_map": "Concept map",
        "knowledge_graph": "Knowledge graph",
        "simulation": "Simulation",
        "summary": "Summary",
        "flashcard_deck": "Flashcards",
    }.get(kind, kind.replace("_", " ").title())


_KIND_TASK = {
    "cheatsheet": "exam.cheatsheet",
    "practice_set": "exam.practice_set",
    "concept_map": "exam.cheatsheet",      # opus-tier reasoning
    "knowledge_graph": "exam.cheatsheet",  # opus-tier reasoning
    "simulation": "exam.practice_set",     # sonnet for question volume
    "summary": "exam.cheatsheet",          # sonnet — narrative summary
    "flashcard_deck": "exam.practice_set", # sonnet — Q/A pair volume
}


async def _seed_weak_topics(
    session: AsyncSession, body: GenerateRequest, user_id: UUID
) -> list[str] | None:
    """If options has seed_from_attempt_id, pull that attempt's weak topics."""
    seed_id = body.options.get("seed_from_attempt_id")
    if not seed_id:
        return body.options.get("weak_topics")
    a = await session.get(ExamAttempt, UUID(seed_id))
    if a is None or a.user_id != user_id or not a.weak_topics:
        return None
    return [w["topic"] for w in a.weak_topics if isinstance(w, dict)]


async def _run_generation(
    artifact_id: UUID, user_id: UUID, ws_id: UUID, body: GenerateRequest
) -> None:
    """Background generation worker. Updates the artifact in place."""
    try:
        async with SessionLocal() as session:
            ws = await session.get(ExamWorkspace, ws_id)
            if ws is None:
                await _fail_artifact(session, artifact_id, "workspace gone")
                return

            # Drop-to-files paste flow: text supplied directly, skip chunks.
            paste_text = body.options.get("paste_text") if body.options else None
            if paste_text:
                source_text = str(paste_text)[:60_000]
            else:
                # Wait briefly for newly-added file_ids to finish ingest.
                # ingest_file is idempotent and returns fast if already-ready.
                source_text = await collect_workspace_text(session, ws_id)
                if not source_text:
                    # Poll up to 25 s for chunks to arrive.
                    for _ in range(25):
                        await asyncio.sleep(1)
                        source_text = await collect_workspace_text(session, ws_id)
                        if source_text:
                            break
                if not source_text:
                    await _fail_artifact(session, artifact_id, "no source content")
                    return

            spec = select_route(_KIND_TASK[body.kind])  # type: ignore[arg-type]
            model = spec.alias  # all exam kinds resolve to anthropic aliases

            if body.kind == "cheatsheet":
                payload = await generate_cheatsheet(
                    model=model, source_text=source_text, title=ws.title,
                    mode=body.mode,
                )
            elif body.kind == "practice_set":
                weak = await _seed_weak_topics(session, body, user_id)
                payload = await generate_practice_set(
                    model=model,
                    source_text=source_text,
                    title=ws.title,
                    n_questions=int(body.options.get("n_questions", 10)),
                    weak_topics=weak,
                )
            elif body.kind == "concept_map":
                payload = await generate_concept_map(
                    model=model, source_text=source_text, title=ws.title,
                )
            elif body.kind == "knowledge_graph":
                payload = await generate_knowledge_graph(
                    model=model, source_text=source_text, title=ws.title,
                )
            elif body.kind == "simulation":
                payload = await generate_simulation(
                    model=model,
                    source_text=source_text,
                    title=ws.title,
                    duration_min=int(body.options.get("duration_min", 90)),
                    n_questions=int(body.options.get("n_questions", 12)),
                    rubric_mode=body.options.get("rubric_mode", "ai-grade"),
                )
            elif body.kind == "summary":
                payload = await generate_summary(
                    model=model,
                    source_text=source_text,
                    title=ws.title,
                    mode=body.mode,
                )
            elif body.kind == "flashcard_deck":
                payload = await generate_flashcards(
                    model=model,
                    source_text=source_text,
                    title=ws.title,
                    n_cards=int(body.options.get("n_cards", 20)),
                )
            else:
                await _fail_artifact(session, artifact_id, f"unsupported kind: {body.kind}")
                return

            tokens_in = payload.pop("tokens_in", None)
            tokens_out = payload.pop("tokens_out", None)

            from app.core.config import settings as _s
            real_model_id = {
                "opus": _s.opus_model_id,
                "sonnet": _s.sonnet_model_id,
                "haiku": _s.haiku_model_id,
            }.get(model, str(model))

            a = await session.get(ExamArtifact, artifact_id)
            if a:
                a.payload = payload
                a.status = "ready"
                a.generated_by_model = real_model_id
            session.add(AICall(
                user_id=user_id,
                task=f"exam.{body.kind}",
                mode=body.mode,
                provider="anthropic",
                model_id=real_model_id,
                tokens_in=tokens_in,
                tokens_out=tokens_out,
            ))
            await session.commit()

        # Notify clients via Socket.io
        try:
            from app.main import sio
            await sio.emit("artifact:complete", {"artifact_id": str(artifact_id)})
        except Exception:
            pass

    except Exception as e:
        log.exception("exam.generate.error", artifact_id=str(artifact_id))
        async with SessionLocal() as session:
            await _fail_artifact(session, artifact_id, str(e)[:500])
        try:
            from app.main import sio
            await sio.emit("artifact:error", {
                "artifact_id": str(artifact_id), "error": str(e)[:300],
            })
        except Exception:
            pass


async def _fail_artifact(
    session: AsyncSession, artifact_id: UUID, error: str
) -> None:
    a = await session.get(ExamArtifact, artifact_id)
    if a is None:
        return
    a.status = "error"
    a.error = error
    await session.commit()
