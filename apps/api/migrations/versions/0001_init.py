"""init

Revision ID: 0001
Revises:
Create Date: 2026-04-26

Bootstrap schema for ESUI. Mirrors docs/01-data.md with MVP cuts:
- no vault_links
- no message branch_id (parent_message_id kept)
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ---------- extensions ----------
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # ---------- identity ----------
    op.execute("""
        CREATE TABLE users (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            email         text NOT NULL UNIQUE,
            display_name  text NOT NULL,
            role          text NOT NULL CHECK (role IN ('esui','badrushk')),
            avatar_url    text,
            timezone      text NOT NULL DEFAULT 'UTC',
            default_mode  text NOT NULL DEFAULT 'ulzii' CHECK (default_mode IN ('ulzii','obama')),
            created_at    timestamptz NOT NULL DEFAULT now()
        )
    """)

    op.execute("""
        CREATE TABLE auth_tokens (
            id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash  bytea NOT NULL,
            expires_at  timestamptz NOT NULL,
            created_at  timestamptz NOT NULL DEFAULT now(),
            revoked_at  timestamptz
        )
    """)
    op.execute("CREATE INDEX ix_auth_tokens_user_id ON auth_tokens (user_id)")
    op.execute("CREATE INDEX ix_auth_tokens_token_hash ON auth_tokens (token_hash)")

    op.execute("""
        CREATE TABLE magic_links (
            id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            email        text NOT NULL,
            token_hash   bytea NOT NULL,
            expires_at   timestamptz NOT NULL,
            consumed_at  timestamptz,
            created_at   timestamptz NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_magic_links_email ON magic_links (email, created_at DESC)")

    # ---------- conversations & messages ----------
    op.execute("""
        CREATE TABLE conversations (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            title           text,
            pinned_context  text,
            created_by      uuid NOT NULL REFERENCES users(id),
            created_at      timestamptz NOT NULL DEFAULT now(),
            updated_at      timestamptz NOT NULL DEFAULT now(),
            archived_at     timestamptz
        )
    """)
    op.execute("CREATE INDEX ix_conversations_created_by ON conversations (created_by, updated_at DESC)")

    op.execute("""
        CREATE TABLE conversation_participants (
            conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            user_id         uuid NOT NULL REFERENCES users(id),
            joined_at       timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (conversation_id, user_id)
        )
    """)

    op.execute("""
        CREATE TABLE messages (
            id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            conversation_id   uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            parent_message_id uuid REFERENCES messages(id),
            sender_type       text NOT NULL CHECK (sender_type IN ('user','ai','system')),
            sender_user_id    uuid REFERENCES users(id),
            mode              text CHECK (mode IS NULL OR mode IN ('ulzii','obama')),
            model_id          text,
            content_blocks    jsonb NOT NULL,
            tokens_in         int,
            tokens_out        int,
            cost_cents        numeric(10, 4),
            status            text NOT NULL DEFAULT 'complete'
                              CHECK (status IN ('streaming','complete','error')),
            error             text,
            created_at        timestamptz NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_messages_conversation ON messages (conversation_id, created_at)")
    op.execute("CREATE INDEX ix_messages_parent ON messages (parent_message_id)")

    op.execute("""
        CREATE TABLE message_embeddings (
            message_id    uuid PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
            embedding     vector(1024) NOT NULL,
            text_indexed  text NOT NULL
        )
    """)
    op.execute(
        "CREATE INDEX ix_message_embeddings_hnsw ON message_embeddings "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )

    # ---------- files ----------
    op.execute("""
        CREATE TABLE files (
            id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            owner_id          uuid NOT NULL REFERENCES users(id),
            kind              text NOT NULL CHECK (kind IN ('pdf','image','doc','audio','other')),
            filename          text NOT NULL,
            mime              text NOT NULL,
            size_bytes        bigint NOT NULL,
            r2_key            text NOT NULL UNIQUE,
            sha256            bytea NOT NULL,
            width             int,
            height            int,
            duration_sec      int,
            together_eligible boolean NOT NULL DEFAULT false,
            ingest_status     text NOT NULL DEFAULT 'pending'
                              CHECK (ingest_status IN ('pending','processing','ready','failed','skipped')),
            ingest_error      text,
            created_at        timestamptz NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_files_owner ON files (owner_id, created_at DESC)")
    op.execute("CREATE INDEX ix_files_sha256 ON files (sha256)")
    op.execute("CREATE INDEX ix_files_together_eligible ON files (owner_id, together_eligible) WHERE together_eligible = true")

    op.execute("""
        CREATE TABLE message_files (
            message_id  uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
            file_id     uuid NOT NULL REFERENCES files(id),
            PRIMARY KEY (message_id, file_id)
        )
    """)

    op.execute("""
        CREATE TABLE file_chunks (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            file_id       uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
            chunk_index   int NOT NULL,
            text          text NOT NULL,
            section_path  text,
            page_start    int,
            page_end      int,
            embedding     vector(1024) NOT NULL,
            token_count   int NOT NULL,
            UNIQUE (file_id, chunk_index)
        )
    """)
    op.execute("CREATE INDEX ix_file_chunks_file ON file_chunks (file_id)")
    op.execute(
        "CREATE INDEX ix_file_chunks_hnsw ON file_chunks "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )

    # ---------- vault ----------
    op.execute("""
        CREATE TABLE vault_documents (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            owner_id        uuid NOT NULL REFERENCES users(id),
            title           text NOT NULL,
            content_md      text NOT NULL,
            content_type    text NOT NULL DEFAULT 'note'
                            CHECK (content_type IN ('note','journal','draft','research','reference')),
            source_file_id  uuid REFERENCES files(id),
            shared          boolean NOT NULL DEFAULT false,
            created_at      timestamptz NOT NULL DEFAULT now(),
            updated_at      timestamptz NOT NULL DEFAULT now(),
            archived_at     timestamptz
        )
    """)
    op.execute("CREATE INDEX ix_vault_documents_owner ON vault_documents (owner_id, updated_at DESC)")
    op.execute("CREATE INDEX ix_vault_documents_shared ON vault_documents (shared) WHERE shared = true")
    op.execute("CREATE INDEX ix_vault_documents_fts ON vault_documents USING gin (to_tsvector('english', title || ' ' || content_md))")

    op.execute("""
        CREATE TABLE vault_chunks (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            document_id   uuid NOT NULL REFERENCES vault_documents(id) ON DELETE CASCADE,
            chunk_index   int NOT NULL,
            text          text NOT NULL,
            embedding     vector(1024) NOT NULL,
            token_count   int NOT NULL,
            UNIQUE (document_id, chunk_index)
        )
    """)
    op.execute(
        "CREATE INDEX ix_vault_chunks_hnsw ON vault_chunks "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )

    op.execute("""
        CREATE TABLE vault_tags (
            document_id  uuid NOT NULL REFERENCES vault_documents(id) ON DELETE CASCADE,
            tag          text NOT NULL,
            source       text NOT NULL CHECK (source IN ('user','ai')),
            PRIMARY KEY (document_id, tag)
        )
    """)
    op.execute("CREATE INDEX ix_vault_tags_tag ON vault_tags (tag)")

    # ---------- exam ----------
    op.execute("""
        CREATE TABLE exam_workspaces (
            id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            owner_id    uuid NOT NULL REFERENCES users(id),
            title       text NOT NULL,
            subject     text,
            created_at  timestamptz NOT NULL DEFAULT now(),
            updated_at  timestamptz NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_exam_workspaces_owner ON exam_workspaces (owner_id, updated_at DESC)")

    op.execute("""
        CREATE TABLE exam_sources (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            workspace_id  uuid NOT NULL REFERENCES exam_workspaces(id) ON DELETE CASCADE,
            file_id       uuid NOT NULL REFERENCES files(id),
            added_at      timestamptz NOT NULL DEFAULT now(),
            UNIQUE (workspace_id, file_id)
        )
    """)

    op.execute("""
        CREATE TABLE exam_artifacts (
            id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            workspace_id        uuid NOT NULL REFERENCES exam_workspaces(id) ON DELETE CASCADE,
            kind                text NOT NULL CHECK (kind IN ('cheatsheet','concept_map','practice_set','knowledge_graph','simulation')),
            title               text NOT NULL,
            payload             jsonb NOT NULL,
            generated_by_model  text,
            generated_in_mode   text CHECK (generated_in_mode IS NULL OR generated_in_mode IN ('ulzii','obama')),
            status              text NOT NULL DEFAULT 'ready' CHECK (status IN ('generating','ready','error')),
            error               text,
            created_at          timestamptz NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_exam_artifacts_workspace ON exam_artifacts (workspace_id, created_at DESC)")

    op.execute("""
        CREATE TABLE exam_attempts (
            id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            artifact_id   uuid NOT NULL REFERENCES exam_artifacts(id) ON DELETE CASCADE,
            user_id       uuid NOT NULL REFERENCES users(id),
            score         real,
            weak_topics   jsonb,
            responses     jsonb,
            duration_sec  int,
            completed_at  timestamptz,
            created_at    timestamptz NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_exam_attempts_artifact ON exam_attempts (artifact_id)")
    op.execute("CREATE INDEX ix_exam_attempts_user ON exam_attempts (user_id, created_at DESC)")

    # ---------- together photos ----------
    op.execute("""
        CREATE TABLE together_prompts (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            shown_at        timestamptz NOT NULL DEFAULT now(),
            shown_to_user   uuid NOT NULL REFERENCES users(id),
            outcome         text NOT NULL DEFAULT 'pending'
                            CHECK (outcome IN ('pending','skipped','accepted','expired')),
            outcome_at      timestamptz,
            message_variant text
        )
    """)
    op.execute("CREATE INDEX ix_together_prompts_user ON together_prompts (shown_to_user, shown_at DESC)")

    op.execute("""
        CREATE TABLE together_photos (
            id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            prompt_id              uuid REFERENCES together_prompts(id),
            esui_photo_file_id     uuid NOT NULL REFERENCES files(id),
            badrushk_photo_file_id uuid NOT NULL REFERENCES files(id),
            composite_file_id      uuid REFERENCES files(id),
            scene_prompt           text NOT NULL,
            status                 text NOT NULL DEFAULT 'queued'
                                   CHECK (status IN ('queued','removing_bg','composing','ready','failed')),
            error                  text,
            created_at             timestamptz NOT NULL DEFAULT now(),
            ready_at               timestamptz
        )
    """)
    op.execute("CREATE INDEX ix_together_photos_status ON together_photos (status)")
    op.execute("CREATE INDEX ix_together_photos_created ON together_photos (created_at DESC)")

    # ---------- signals ----------
    op.execute("""
        CREATE TABLE signals (
            id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            category     text NOT NULL CHECK (category IN ('global','tech','mathematics','arabic_philosophy','chinese_philosophy','research')),
            title        text NOT NULL,
            body         text NOT NULL,
            source_url   text,
            source_name  text,
            fetched_at   timestamptz NOT NULL DEFAULT now(),
            expires_at   timestamptz NOT NULL,
            cycle_id     uuid NOT NULL,
            embedding    vector(1024)
        )
    """)
    op.execute("CREATE INDEX ix_signals_category ON signals (category, fetched_at DESC)")
    op.execute("CREATE INDEX ix_signals_expires ON signals (expires_at)")
    op.execute("CREATE INDEX ix_signals_cycle ON signals (cycle_id)")
    op.execute(
        "CREATE INDEX ix_signals_hnsw ON signals "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )

    op.execute("""
        CREATE TABLE signal_engagements (
            signal_id    uuid NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
            user_id      uuid NOT NULL REFERENCES users(id),
            action       text NOT NULL CHECK (action IN ('open','pin','dismiss','share_to_chat')),
            created_at   timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (signal_id, user_id, action, created_at)
        )
    """)
    op.execute("CREATE INDEX ix_signal_engagements_user ON signal_engagements (user_id, created_at DESC)")

    op.execute("""
        CREATE TABLE signal_pins (
            id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            signal_id          uuid NOT NULL REFERENCES signals(id),
            user_id            uuid NOT NULL REFERENCES users(id),
            vault_document_id  uuid NOT NULL REFERENCES vault_documents(id),
            created_at         timestamptz NOT NULL DEFAULT now(),
            UNIQUE (signal_id, user_id)
        )
    """)

    # ---------- memory engine ----------
    op.execute("""
        CREATE TABLE memories (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            owner_id        uuid NOT NULL REFERENCES users(id),
            scope           text NOT NULL DEFAULT 'global' CHECK (scope IN ('global','project','conversation')),
            scope_ref_id    uuid,
            text            text NOT NULL,
            category        text CHECK (category IS NULL OR category IN ('preference','goal','decision','fact_about_user','fact_about_world','project_state','relationship')),
            embedding       vector(1024) NOT NULL,
            source_kind     text CHECK (source_kind IS NULL OR source_kind IN ('chat','vault','exam','signal','manual')),
            source_id       uuid,
            salience        real NOT NULL DEFAULT 1.0,
            confidence      real NOT NULL DEFAULT 1.0,
            forgotten       boolean NOT NULL DEFAULT false,
            created_at      timestamptz NOT NULL DEFAULT now(),
            last_used_at    timestamptz,
            superseded_by   uuid REFERENCES memories(id)
        )
    """)
    op.execute("CREATE INDEX ix_memories_owner_created ON memories (owner_id, created_at DESC)")
    op.execute("CREATE INDEX ix_memories_owner_category ON memories (owner_id, category)")
    op.execute(
        "CREATE INDEX ix_memories_hnsw ON memories "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )
    op.execute("CREATE INDEX ix_memories_active ON memories (owner_id) WHERE superseded_by IS NULL AND NOT forgotten")

    # ---------- observability ----------
    op.execute("""
        CREATE TABLE ai_calls (
            id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id         uuid NOT NULL REFERENCES users(id),
            conversation_id uuid REFERENCES conversations(id),
            message_id      uuid REFERENCES messages(id),
            task            text NOT NULL,
            mode            text,
            provider        text NOT NULL,
            model_id        text NOT NULL,
            tokens_in       int,
            tokens_out      int,
            tokens_cached   int,
            cost_cents      numeric(10, 4),
            latency_ms      int,
            cache_hit       boolean,
            error           text,
            created_at      timestamptz NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_ai_calls_user ON ai_calls (user_id, created_at DESC)")
    op.execute("CREATE INDEX ix_ai_calls_task ON ai_calls (task, created_at DESC)")


def downgrade() -> None:
    # Drop in reverse dependency order
    op.execute("DROP TABLE IF EXISTS ai_calls CASCADE")
    op.execute("DROP TABLE IF EXISTS memories CASCADE")
    op.execute("DROP TABLE IF EXISTS signal_pins CASCADE")
    op.execute("DROP TABLE IF EXISTS signal_engagements CASCADE")
    op.execute("DROP TABLE IF EXISTS signals CASCADE")
    op.execute("DROP TABLE IF EXISTS together_photos CASCADE")
    op.execute("DROP TABLE IF EXISTS together_prompts CASCADE")
    op.execute("DROP TABLE IF EXISTS exam_attempts CASCADE")
    op.execute("DROP TABLE IF EXISTS exam_artifacts CASCADE")
    op.execute("DROP TABLE IF EXISTS exam_sources CASCADE")
    op.execute("DROP TABLE IF EXISTS exam_workspaces CASCADE")
    op.execute("DROP TABLE IF EXISTS vault_tags CASCADE")
    op.execute("DROP TABLE IF EXISTS vault_chunks CASCADE")
    op.execute("DROP TABLE IF EXISTS vault_documents CASCADE")
    op.execute("DROP TABLE IF EXISTS file_chunks CASCADE")
    op.execute("DROP TABLE IF EXISTS message_files CASCADE")
    op.execute("DROP TABLE IF EXISTS files CASCADE")
    op.execute("DROP TABLE IF EXISTS message_embeddings CASCADE")
    op.execute("DROP TABLE IF EXISTS messages CASCADE")
    op.execute("DROP TABLE IF EXISTS conversation_participants CASCADE")
    op.execute("DROP TABLE IF EXISTS conversations CASCADE")
    op.execute("DROP TABLE IF EXISTS magic_links CASCADE")
    op.execute("DROP TABLE IF EXISTS auth_tokens CASCADE")
    op.execute("DROP TABLE IF EXISTS users CASCADE")
