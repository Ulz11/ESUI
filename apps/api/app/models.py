"""SQLAlchemy ORM models for ESUI.

Schema mirrors `docs/01-data.md`, with these MVP simplifications:
- no `vault_links` (knowledge graph view deferred)
- no `messages.branch_id` (branching deferred; `parent_message_id` kept for forward compat)
- `memories.superseded_by` and `forgotten` columns kept on the table for forward compat
  but consolidation/forgetting flows are deferred

Embeddings are 1024-dim (Voyage `voyage-3`).
"""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    LargeBinary,
    Numeric,
    PrimaryKeyConstraint,
    Real,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, created_ts, nullable_ts, uuid_fk, uuid_pk


# ---------- Identity ----------


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid_pk]
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    timezone: Mapped[str] = mapped_column(String, default="UTC", nullable=False)
    default_mode: Mapped[str] = mapped_column(String, default="ulzii", nullable=False)
    created_at: Mapped[created_ts]

    __table_args__ = (
        CheckConstraint("role IN ('esui','badrushk')", name="users_role_check"),
        CheckConstraint(
            "default_mode IN ('ulzii','obama')", name="users_default_mode_check"
        ),
    )


class AuthToken(Base):
    __tablename__ = "auth_tokens"

    id: Mapped[uuid_pk]
    user_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[bytes] = mapped_column(LargeBinary, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    created_at: Mapped[created_ts]
    revoked_at: Mapped[nullable_ts]


class MagicLink(Base):
    __tablename__ = "magic_links"

    id: Mapped[uuid_pk]
    email: Mapped[str] = mapped_column(String, nullable=False, index=True)
    token_hash: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    consumed_at: Mapped[nullable_ts]
    created_at: Mapped[created_ts]


# ---------- Conversations & messages ----------


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid_pk]
    title: Mapped[str | None] = mapped_column(String, nullable=True)
    pinned_context: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid_fk] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    created_at: Mapped[created_ts]
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default="now()"
    )
    archived_at: Mapped[nullable_ts]


class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"

    conversation_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    joined_at: Mapped[created_ts]

    __table_args__ = (
        PrimaryKeyConstraint("conversation_id", "user_id"),
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid_pk]
    conversation_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_message_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("messages.id"), nullable=True, index=True
    )
    sender_type: Mapped[str] = mapped_column(String, nullable=False)
    sender_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    mode: Mapped[str | None] = mapped_column(String, nullable=True)
    model_id: Mapped[str | None] = mapped_column(String, nullable=True)
    content_blocks: Mapped[list] = mapped_column(JSONB, nullable=False)
    tokens_in: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_out: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cost_cents: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 4), nullable=True
    )
    status: Mapped[str] = mapped_column(String, nullable=False, default="complete")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[created_ts]

    __table_args__ = (
        CheckConstraint(
            "sender_type IN ('user','ai','system')", name="msg_sender_type_check"
        ),
        CheckConstraint(
            "mode IS NULL OR mode IN ('ulzii','obama')", name="msg_mode_check"
        ),
        CheckConstraint(
            "status IN ('streaming','complete','error')", name="msg_status_check"
        ),
    )


class MessageEmbedding(Base):
    __tablename__ = "message_embeddings"

    message_id: Mapped[UUID] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"), primary_key=True
    )
    embedding: Mapped[list[float]] = mapped_column(Vector(1024), nullable=False)
    text_indexed: Mapped[str] = mapped_column(Text, nullable=False)


# ---------- Files ----------


class File(Base):
    __tablename__ = "files"

    id: Mapped[uuid_pk]
    owner_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String, nullable=False)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    mime: Mapped[str] = mapped_column(String, nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    r2_key: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    sha256: Mapped[bytes] = mapped_column(LargeBinary, nullable=False, index=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_sec: Mapped[int | None] = mapped_column(Integer, nullable=True)
    together_eligible: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    ingest_status: Mapped[str] = mapped_column(
        String, nullable=False, default="pending"
    )
    ingest_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[created_ts]

    __table_args__ = (
        CheckConstraint(
            "kind IN ('pdf','image','doc','audio','other')", name="files_kind_check"
        ),
        CheckConstraint(
            "ingest_status IN ('pending','processing','ready','failed','skipped')",
            name="files_ingest_status_check",
        ),
    )


class MessageFile(Base):
    __tablename__ = "message_files"

    message_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"), nullable=False
    )
    file_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("files.id"), nullable=False
    )

    __table_args__ = (PrimaryKeyConstraint("message_id", "file_id"),)


class FileChunk(Base):
    __tablename__ = "file_chunks"

    id: Mapped[uuid_pk]
    file_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    section_path: Mapped[str | None] = mapped_column(String, nullable=True)
    page_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    page_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    embedding: Mapped[list[float]] = mapped_column(Vector(1024), nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (UniqueConstraint("file_id", "chunk_index"),)


# ---------- Vault ----------


class VaultDocument(Base):
    __tablename__ = "vault_documents"

    id: Mapped[uuid_pk]
    owner_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    content_md: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(
        String, nullable=False, default="note"
    )
    source_file_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("files.id"), nullable=True
    )
    shared: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[created_ts]
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default="now()"
    )
    archived_at: Mapped[nullable_ts]

    __table_args__ = (
        CheckConstraint(
            "content_type IN ('note','journal','draft','research','reference')",
            name="vault_content_type_check",
        ),
    )


class VaultChunk(Base):
    __tablename__ = "vault_chunks"

    id: Mapped[uuid_pk]
    document_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("vault_documents.id", ondelete="CASCADE"), nullable=False
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(1024), nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (UniqueConstraint("document_id", "chunk_index"),)


class VaultTag(Base):
    __tablename__ = "vault_tags"

    document_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("vault_documents.id", ondelete="CASCADE"), nullable=False
    )
    tag: Mapped[str] = mapped_column(String, nullable=False, index=True)
    source: Mapped[str] = mapped_column(String, nullable=False)

    __table_args__ = (
        PrimaryKeyConstraint("document_id", "tag"),
        CheckConstraint("source IN ('user','ai')", name="vault_tag_source_check"),
    )


class VaultLink(Base):
    __tablename__ = "vault_links"

    id: Mapped[uuid_pk]
    source_doc_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("vault_documents.id", ondelete="CASCADE"), nullable=False
    )
    target_doc_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("vault_documents.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String, nullable=False)
    strength: Mapped[float | None] = mapped_column(Real, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[created_ts]

    __table_args__ = (
        UniqueConstraint("source_doc_id", "target_doc_id", "kind"),
        CheckConstraint("kind IN ('semantic','explicit')", name="vault_links_kind_check"),
    )


# ---------- Exam ----------


class ExamWorkspace(Base):
    __tablename__ = "exam_workspaces"

    id: Mapped[uuid_pk]
    owner_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    subject: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[created_ts]
    updated_at: Mapped[datetime] = mapped_column(
        nullable=False, server_default="now()"
    )


class ExamSource(Base):
    __tablename__ = "exam_sources"

    id: Mapped[uuid_pk]
    workspace_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("exam_workspaces.id", ondelete="CASCADE"), nullable=False
    )
    file_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("files.id"), nullable=False
    )
    added_at: Mapped[created_ts]

    __table_args__ = (UniqueConstraint("workspace_id", "file_id"),)


class ExamArtifact(Base):
    __tablename__ = "exam_artifacts"

    id: Mapped[uuid_pk]
    workspace_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("exam_workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    generated_by_model: Mapped[str | None] = mapped_column(String, nullable=True)
    generated_in_mode: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="ready")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[created_ts]

    __table_args__ = (
        CheckConstraint(
            # MVP supports only 'cheatsheet' and 'practice_set'; constraint allows
            # the full set for forward compat.
            "kind IN ('cheatsheet','concept_map','practice_set','knowledge_graph','simulation')",
            name="exam_artifacts_kind_check",
        ),
        CheckConstraint(
            "generated_in_mode IS NULL OR generated_in_mode IN ('ulzii','obama')",
            name="exam_artifacts_mode_check",
        ),
        CheckConstraint(
            "status IN ('generating','ready','error')",
            name="exam_artifacts_status_check",
        ),
    )


class ExamAttempt(Base):
    __tablename__ = "exam_attempts"

    id: Mapped[uuid_pk]
    artifact_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("exam_artifacts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    score: Mapped[float | None] = mapped_column(Real, nullable=True)
    weak_topics: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    responses: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    duration_sec: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completed_at: Mapped[nullable_ts]
    created_at: Mapped[created_ts]


# ---------- Together Photos ----------


class TogetherPrompt(Base):
    __tablename__ = "together_prompts"

    id: Mapped[uuid_pk]
    shown_at: Mapped[created_ts]
    shown_to_user: Mapped[uuid_fk] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    outcome: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    outcome_at: Mapped[nullable_ts]
    message_variant: Mapped[str | None] = mapped_column(String, nullable=True)

    __table_args__ = (
        CheckConstraint(
            "outcome IN ('pending','skipped','accepted','expired')",
            name="together_prompts_outcome_check",
        ),
    )


class TogetherPhoto(Base):
    __tablename__ = "together_photos"

    id: Mapped[uuid_pk]
    prompt_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("together_prompts.id"), nullable=True
    )
    esui_photo_file_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("files.id"), nullable=False
    )
    badrushk_photo_file_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("files.id"), nullable=False
    )
    composite_file_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("files.id"), nullable=True
    )
    scene_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="queued")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[created_ts]
    ready_at: Mapped[nullable_ts]

    __table_args__ = (
        CheckConstraint(
            "status IN ('queued','removing_bg','composing','ready','failed')",
            name="together_photos_status_check",
        ),
    )


# ---------- Signals ----------


class Signal(Base):
    __tablename__ = "signals"

    id: Mapped[uuid_pk]
    category: Mapped[str] = mapped_column(String, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)
    source_name: Mapped[str | None] = mapped_column(String, nullable=True)
    fetched_at: Mapped[created_ts]
    expires_at: Mapped[datetime] = mapped_column(nullable=False, index=True)
    cycle_id: Mapped[UUID] = mapped_column(
        nullable=False, index=True
    )
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(1024), nullable=True
    )

    __table_args__ = (
        CheckConstraint(
            "category IN ('global','tech','mathematics','arabic_philosophy',"
            "'chinese_philosophy','research')",
            name="signals_category_check",
        ),
    )


class SignalEngagement(Base):
    __tablename__ = "signal_engagements"

    signal_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("signals.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    action: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[created_ts]

    __table_args__ = (
        PrimaryKeyConstraint("signal_id", "user_id", "action", "created_at"),
        CheckConstraint(
            "action IN ('open','pin','dismiss','share_to_chat')",
            name="signal_engagements_action_check",
        ),
    )


class SignalPin(Base):
    __tablename__ = "signal_pins"

    id: Mapped[uuid_pk]
    signal_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("signals.id"), nullable=False
    )
    user_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    vault_document_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("vault_documents.id"), nullable=False
    )
    created_at: Mapped[created_ts]

    __table_args__ = (UniqueConstraint("signal_id", "user_id"),)


# ---------- Memory engine ----------


class Memory(Base):
    __tablename__ = "memories"

    id: Mapped[uuid_pk]
    owner_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    scope: Mapped[str] = mapped_column(String, nullable=False, default="global")
    scope_ref_id: Mapped[UUID | None] = mapped_column(nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    embedding: Mapped[list[float]] = mapped_column(Vector(1024), nullable=False)
    source_kind: Mapped[str | None] = mapped_column(String, nullable=True)
    source_id: Mapped[UUID | None] = mapped_column(nullable=True)
    salience: Mapped[float] = mapped_column(Real, nullable=False, default=1.0)
    confidence: Mapped[float] = mapped_column(Real, nullable=False, default=1.0)
    forgotten: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[created_ts]
    last_used_at: Mapped[nullable_ts]
    superseded_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("memories.id"), nullable=True
    )

    __table_args__ = (
        CheckConstraint(
            "scope IN ('global','project','conversation')",
            name="memories_scope_check",
        ),
        CheckConstraint(
            "category IS NULL OR category IN ("
            "'preference','goal','decision','fact_about_user',"
            "'fact_about_world','project_state','relationship'"
            ")",
            name="memories_category_check",
        ),
        CheckConstraint(
            "source_kind IS NULL OR source_kind IN ('chat','vault','exam','signal','manual')",
            name="memories_source_kind_check",
        ),
    )


# ---------- Observability ----------


class AICall(Base):
    __tablename__ = "ai_calls"

    id: Mapped[uuid_pk]
    user_id: Mapped[uuid_fk] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    conversation_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("conversations.id"), nullable=True
    )
    message_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("messages.id"), nullable=True
    )
    task: Mapped[str] = mapped_column(String, nullable=False, index=True)
    mode: Mapped[str | None] = mapped_column(String, nullable=True)
    provider: Mapped[str] = mapped_column(String, nullable=False)
    model_id: Mapped[str] = mapped_column(String, nullable=False)
    tokens_in: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_out: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_cached: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cost_cents: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 4), nullable=True
    )
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cache_hit: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[created_ts]
