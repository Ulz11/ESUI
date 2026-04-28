# ESUI — Data Model

Single Postgres 16 instance with `pgvector`. All vectors are 1024-dim (Voyage AI `voyage-3`). One Redis instance for cache + pubsub. One Cloudflare R2 bucket for files.

All primary keys are `uuid` (`gen_random_uuid()`). All timestamps are `timestamptz` (UTC, app-side display in user's tz).

---

## 1. Postgres extensions

```sql
CREATE EXTENSION IF NOT EXISTS pgvector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- fuzzy text search
CREATE EXTENSION IF NOT EXISTS pgcrypto;      -- gen_random_uuid()
```

---

## 2. Identity

```sql
-- Two rows. Always.
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  display_name  text NOT NULL,
  role          text NOT NULL CHECK (role IN ('esui', 'badrushk')),
  avatar_url    text,
  timezone      text NOT NULL DEFAULT 'UTC',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    bytea NOT NULL,        -- sha256(token)
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz
);
CREATE INDEX ON auth_tokens (user_id);
CREATE INDEX ON auth_tokens (token_hash);

CREATE TABLE magic_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  token_hash    bytea NOT NULL,
  expires_at    timestamptz NOT NULL,
  consumed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON magic_links (email, created_at DESC);
```

---

## 3. Conversations

```sql
CREATE TABLE conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text,                 -- AI-generated after first 3 turns
  pinned_context  text,                 -- user-pinned project context
  created_by      uuid NOT NULL REFERENCES users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  archived_at     timestamptz
);
CREATE INDEX ON conversations (created_by, updated_at DESC);

CREATE TABLE conversation_participants (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id),
  joined_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  parent_message_id uuid REFERENCES messages(id),  -- for branching
  branch_id         uuid NOT NULL,                  -- groups a branch lineage
  sender_type       text NOT NULL CHECK (sender_type IN ('user', 'ai', 'system')),
  sender_user_id    uuid REFERENCES users(id),     -- null when sender_type='ai'
  mode              text CHECK (mode IN ('ulzii', 'obama')),  -- only for sender_type='ai'
  model_id          text,                           -- e.g. 'claude-opus-4-7'
  content_blocks    jsonb NOT NULL,                 -- [{type:'text'|'image'|'file'|'signal_card'|...}, ...]
  tokens_in         int,
  tokens_out        int,
  cost_cents        numeric(10, 4),
  status            text NOT NULL DEFAULT 'complete'
                    CHECK (status IN ('streaming', 'complete', 'error')),
  error             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON messages (conversation_id, created_at);
CREATE INDEX ON messages (parent_message_id);
CREATE INDEX ON messages (branch_id, created_at);

-- Embeddings for semantic search across conversation history
CREATE TABLE message_embeddings (
  message_id   uuid PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
  embedding    vector(1024) NOT NULL,
  text_indexed text NOT NULL
);
CREATE INDEX ON message_embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

**Branching:** every message has a `branch_id`. The "main" branch's id equals the conversation's first message id. Branching at message M creates a new `branch_id`; new replies stay on that branch. Listing a conversation = filter by branch_id.

---

## 4. Files

```sql
CREATE TABLE files (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          uuid NOT NULL REFERENCES users(id),
  kind              text NOT NULL CHECK (kind IN ('pdf','image','doc','audio','other')),
  filename          text NOT NULL,
  mime              text NOT NULL,
  size_bytes        bigint NOT NULL,
  r2_key            text NOT NULL UNIQUE,
  sha256            bytea NOT NULL,
  width             int,                    -- images only
  height            int,
  duration_sec      int,                    -- audio only
  together_eligible boolean NOT NULL DEFAULT false,  -- Badrushk marks photos available for compositing
  ingest_status     text NOT NULL DEFAULT 'pending'
                    CHECK (ingest_status IN ('pending','processing','ready','failed','skipped')),
  ingest_error      text,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON files (owner_id, created_at DESC);
CREATE INDEX ON files (sha256);
CREATE INDEX ON files (owner_id, together_eligible) WHERE together_eligible = true;

CREATE TABLE message_files (
  message_id  uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  file_id     uuid NOT NULL REFERENCES files(id),
  PRIMARY KEY (message_id, file_id)
);

-- Parsed + embedded chunks for retrieval
CREATE TABLE file_chunks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id      uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  chunk_index  int NOT NULL,
  text         text NOT NULL,
  section_path text,                        -- "Chapter 2 > Convergence"
  page_start   int,
  page_end     int,
  embedding    vector(1024) NOT NULL,
  token_count  int NOT NULL,
  UNIQUE (file_id, chunk_index)
);
CREATE INDEX ON file_chunks (file_id);
CREATE INDEX ON file_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

---

## 5. Vault

```sql
CREATE TABLE vault_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES users(id),
  title           text NOT NULL,
  content_md      text NOT NULL,        -- markdown source of truth
  content_type    text NOT NULL DEFAULT 'note'
                  CHECK (content_type IN ('note','journal','draft','research','reference')),
  source_file_id  uuid REFERENCES files(id),  -- if imported from a file
  shared          boolean NOT NULL DEFAULT false,  -- visible to both users when true
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  archived_at     timestamptz
);
CREATE INDEX ON vault_documents (owner_id, updated_at DESC);
CREATE INDEX ON vault_documents (shared) WHERE shared = true;
CREATE INDEX ON vault_documents USING gin (to_tsvector('english', title || ' ' || content_md));

CREATE TABLE vault_chunks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES vault_documents(id) ON DELETE CASCADE,
  chunk_index   int NOT NULL,
  text          text NOT NULL,
  embedding     vector(1024) NOT NULL,
  token_count   int NOT NULL,
  UNIQUE (document_id, chunk_index)
);
CREATE INDEX ON vault_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE TABLE vault_tags (
  document_id   uuid NOT NULL REFERENCES vault_documents(id) ON DELETE CASCADE,
  tag           text NOT NULL,
  source        text NOT NULL CHECK (source IN ('user','ai')),
  PRIMARY KEY (document_id, tag)
);
CREATE INDEX ON vault_tags (tag);

-- Semantic + explicit links between documents
CREATE TABLE vault_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_doc_id   uuid NOT NULL REFERENCES vault_documents(id) ON DELETE CASCADE,
  target_doc_id   uuid NOT NULL REFERENCES vault_documents(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('semantic','explicit')),
  strength        real,                          -- cosine similarity for semantic
  note            text,                          -- user-added for explicit
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_doc_id, target_doc_id, kind)
);
```

---

## 6. Exam

```sql
CREATE TABLE exam_workspaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES users(id),
  title       text NOT NULL,
  subject     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON exam_workspaces (owner_id, updated_at DESC);

CREATE TABLE exam_sources (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES exam_workspaces(id) ON DELETE CASCADE,
  file_id       uuid NOT NULL REFERENCES files(id),
  added_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, file_id)
);

CREATE TABLE exam_artifacts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES exam_workspaces(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN (
                  'cheatsheet','concept_map','practice_set','knowledge_graph','simulation'
                )),
  title         text NOT NULL,
  payload       jsonb NOT NULL,           -- shape depends on kind, see 04-widgets.md
  generated_by_model text,
  generated_in_mode  text CHECK (generated_in_mode IN ('ulzii','obama')),
  status        text NOT NULL DEFAULT 'ready'
                CHECK (status IN ('generating','ready','error')),
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON exam_artifacts (workspace_id, created_at DESC);

CREATE TABLE exam_attempts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id   uuid NOT NULL REFERENCES exam_artifacts(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id),
  score         real,
  weak_topics   jsonb,                    -- array of {topic, confidence}
  responses     jsonb,                    -- per-question responses
  duration_sec  int,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON exam_attempts (artifact_id);
CREATE INDEX ON exam_attempts (user_id, created_at DESC);
```

---

## 7. Together Photos

```sql
CREATE TABLE together_prompts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shown_at        timestamptz NOT NULL DEFAULT now(),
  shown_to_user   uuid NOT NULL REFERENCES users(id),  -- always Esui in v1
  outcome         text NOT NULL DEFAULT 'pending'
                  CHECK (outcome IN ('pending','skipped','accepted','expired')),
  outcome_at      timestamptz,
  message_variant text                                 -- which warm message was shown if skipped
);
CREATE INDEX ON together_prompts (shown_to_user, shown_at DESC);

CREATE TABLE together_photos (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id              uuid REFERENCES together_prompts(id),
  esui_photo_file_id     uuid NOT NULL REFERENCES files(id),
  badrushk_photo_file_id uuid NOT NULL REFERENCES files(id),
  composite_file_id      uuid REFERENCES files(id),    -- null until ready
  scene_prompt           text NOT NULL,                -- AI-generated scene description
  status                 text NOT NULL DEFAULT 'queued'
                         CHECK (status IN ('queued','removing_bg','composing','ready','failed')),
  error                  text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  ready_at               timestamptz
);
CREATE INDEX ON together_photos (status);
CREATE INDEX ON together_photos (created_at DESC);
```

---

## 8. Signals

```sql
CREATE TABLE signals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category     text NOT NULL CHECK (category IN (
                 'global','tech','mathematics','arabic_philosophy',
                 'chinese_philosophy','research'
               )),
  title        text NOT NULL,
  body         text NOT NULL,                  -- 2-4 sentence distilled signal
  source_url   text,
  source_name  text,
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,           -- fetched_at + 24h unless pinned
  cycle_id     uuid NOT NULL,                  -- groups items in a refresh cycle
  embedding    vector(1024)                    -- for similarity dedup + retrieval
);
CREATE INDEX ON signals (category, fetched_at DESC);
CREATE INDEX ON signals (expires_at);
CREATE INDEX ON signals (cycle_id);
CREATE INDEX ON signals USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE TABLE signal_engagements (
  signal_id    uuid NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id),
  action       text NOT NULL CHECK (action IN ('open','pin','dismiss','share_to_chat')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (signal_id, user_id, action, created_at)
);
CREATE INDEX ON signal_engagements (user_id, created_at DESC);

-- A pinned signal becomes a Vault document for permanence
CREATE TABLE signal_pins (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id         uuid NOT NULL REFERENCES signals(id),
  user_id           uuid NOT NULL REFERENCES users(id),
  vault_document_id uuid NOT NULL REFERENCES vault_documents(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (signal_id, user_id)
);
```

---

## 9. Memory engine

```sql
-- Long-term semantic memories (Mem0-managed but stored here for visibility/portability)
CREATE TABLE memories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        uuid NOT NULL REFERENCES users(id),
  scope           text NOT NULL DEFAULT 'global'
                  CHECK (scope IN ('global','project','conversation')),
  scope_ref_id    uuid,                                   -- conversation_id or vault_document_id
  text            text NOT NULL,
  category        text CHECK (category IN (
                    'preference','goal','decision','fact_about_user',
                    'fact_about_world','project_state','relationship'
                  )),
  embedding       vector(1024) NOT NULL,
  source_kind     text CHECK (source_kind IN ('chat','vault','exam','signal','manual')),
  source_id       uuid,                                   -- the originating message/doc id
  salience        real NOT NULL DEFAULT 1.0,              -- 0..1, decays over time
  confidence      real NOT NULL DEFAULT 1.0,
  forgotten       boolean NOT NULL DEFAULT false,         -- user-marked forget
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_used_at    timestamptz,
  superseded_by   uuid REFERENCES memories(id)            -- soft-replace when contradicted
);
CREATE INDEX ON memories (owner_id, created_at DESC);
CREATE INDEX ON memories (owner_id, category);
CREATE INDEX ON memories USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
CREATE INDEX ON memories (owner_id) WHERE superseded_by IS NULL AND NOT forgotten;
```

`memories` is the unified destination for Mem0's extracted facts. Mem0 is configured with a custom Postgres adapter that writes here (see `03-ai.md` §5).

---

## 10. Observability

```sql
CREATE TABLE ai_calls (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id),
  conversation_id uuid REFERENCES conversations(id),
  message_id      uuid REFERENCES messages(id),
  task            text NOT NULL,           -- 'chat','cheatsheet','embedding','memory_extract',...
  mode            text CHECK (mode IN ('ulzii','obama')),
  provider        text NOT NULL,           -- 'anthropic'|'google'|'moonshot'|'voyage'
  model_id        text NOT NULL,
  tokens_in       int,
  tokens_out      int,
  tokens_cached   int,
  cost_cents      numeric(10,4),
  latency_ms      int,
  cache_hit       boolean,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON ai_calls (user_id, created_at DESC);
CREATE INDEX ON ai_calls (task, created_at DESC);
```

---

## 11. Indexes summary (HNSW)

All vector columns use HNSW with cosine ops, `m=16, ef_construction=64`. For ESUI's scale (low tens of thousands of vectors), this gives sub-10ms retrieval at high recall.

Query-side: `SET LOCAL hnsw.ef_search = 80;` per query when high recall matters (default 40 is fine for chat).

---

## 12. Redis keyspaces

```
session:<token_hash>                 -> {user_id, expires_at}              (TTL = expiry)
ratelimit:<user_id>:<bucket>         -> count                              (TTL = window)
sio:rooms:<conversation_id>          -> set of socket ids
presence:<conversation_id>           -> hash {user_id: last_seen_ts}
typing:<conversation_id>:<user_id>   -> 1                                  (TTL = 5s)
ephemeral_signals:current            -> json (latest 6h cycle)             (TTL = 6h)
together:cooldown:<user_id>          -> 1                                  (TTL = 6h, gates next prompt)
together:warm_msg_recent:<user_id>   -> set of recently-shown variants     (TTL = 7d)
ingest:progress:<file_id>            -> {step, percent}                    (TTL = 1h)
composite:progress:<photo_id>        -> {step, percent}                    (TTL = 1h)
artifact:progress:<artifact_id>      -> {step, percent}                    (TTL = 1h)
mode:default:<user_id>               -> 'ulzii'|'obama'                    (no TTL — last selected)
```

Celery uses Redis databases 1 (broker) and 2 (results). Application uses DB 0.

---

## 13. R2 layout

```
files/{user_id}/{yyyy}/{mm}/{file_id}{.ext}
together/composites/{photo_id}.png
together/intermediates/{photo_id}/esui_nobg.png
together/intermediates/{photo_id}/badrushk_nobg.png
exports/{user_id}/{export_id}.zip            -- on user-requested data export
```

All objects are private; access is via signed URLs (10-minute TTL) issued by FastAPI after authorization. Bucket lifecycle rule deletes incomplete multipart uploads after 24h.

---

## 14. Migrations

Alembic. One migration per schema change. The bootstrap migration creates everything in this doc. Subsequent migrations are additive — never destructive without explicit user request.

Schema versioning is tracked in `alembic_version`. Application boot fails if migrations are unapplied.

---

## 15. Authorization model (in-app)

There is no role-based access control. Two simple rules:

1. **Ownership.** A row is visible to its `owner_id` (or `created_by`). Conversations are visible to any `conversation_participants` row.
2. **Sharing.** A `vault_documents.shared = true` row is visible to both users.

That's it. Every query in the data layer carries `owner_id = current_user.id` (or the union of `current_user.id` + the partner where sharing applies). No row-level security in Postgres for v1 — application enforces, single FastAPI process makes this safe.

---

## 16. Data export & deletion

- **Export:** `POST /me/export` enqueues a Celery task that walks all owned rows, dumps to a zip in R2, emails a signed download link via Resend. TTL on the export is 7 days.
- **Delete:** `DELETE /me` is intentionally not exposed via UI. If ever needed, manual operator action: drop user row → cascading deletes via FK → delete R2 prefix `files/{user_id}/`.
