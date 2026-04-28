# ESUI — Async Jobs (Celery)

All long-running, scheduled, or external-API work runs in Celery. Web requests never block on these.

Broker: Redis (DB 1). Result backend: Redis (DB 2). Results expire in 1h — anything important persists in Postgres.

---

## 1. Worker pool layout

Two queues, two pools:

| Queue        | Pool size | Tasks                                                            |
|--------------|-----------|------------------------------------------------------------------|
| `realtime`   | 4         | ingest, composite, exam_generate                                 |
| `background` | 2         | signals_refresh, memory_consolidate, cleanup, prompt_scheduler   |

Realtime tasks block UI flows and need responsiveness; background tasks are fine to queue up. Two separate Fly.io machines so a heavy background backlog never starves realtime.

Concurrency model: `prefork` for realtime (safer for blocking I/O like Remove.bg), `gevent` for background (cheap concurrency for many small fetches).

---

## 2. Task catalog

### `ingest.parse_and_embed` — queue `realtime`

**Inputs:** `file_id`, `target` (`'file_chunks' | 'vault_chunks'`), `vault_document_id?`

**Steps:**
1. Set `files.ingest_status = 'processing'`. Emit `ingest:progress { percent: 0 }`.
2. Download object from R2.
3. Call unstructured.io (`hi_res` if PDF with tables/figures, `fast` otherwise) → sectioned blocks.
4. Chunk: ~512 tokens, max 768, 64-token overlap, section-aware. Emit `progress: 30`.
5. Voyage embed in batches of 16. Emit `progress: 30 → 90` linearly.
6. Bulk insert into target table (`file_chunks` or `vault_chunks`).
7. Optional: classifier (Haiku) — auto-tag, classify, extract title if missing. Emit `progress: 95`.
8. Set `ingest_status = 'ready'`. Emit `ingest:complete`.

**Retry:** 3× exponential. On final failure: `ingest_status = 'failed'`, store error, emit `ingest:error`.

**Idempotency:** delete-then-insert chunks within a transaction so partial re-runs converge.

---

### `composite.compose` — queue `realtime`

**Inputs:** `together_photo_id`

**Steps:**
1. Set `status = 'removing_bg'`. Emit `composite:progress { step: 'removing_bg', percent: 10 }`.
2. Remove.bg API on Esui photo → save to R2 intermediates. Same for Badrushk photo. Emit `progress: 40`.
3. Generate scene prompt via Sonnet (`together.scene_prompt`). Emit `progress: 50`.
4. Set `status = 'composing'`. Emit `composite:progress { step: 'composing', percent: 60 }`.
5. Stability AI SDXL with cutouts as ControlNet inputs.
6. On Stability fail OR low-quality heuristic: FAL.ai Flux fallback. Emit `progress: 80`.
7. Save composite PNG to `together/composites/{photo_id}.png`. Insert `files` row, set `composite_file_id`.
8. Set `status = 'ready'`, `ready_at = now()`. Emit `composite:ready`.

**Retry:** 2× per external API failure. On final failure: `status = 'failed'`, store error. Emit `composite:failed`.

**Special:** intermediates are kept 30d for redo, then GC'd by `cleanup.r2_orphans`.

---

### `exam.generate_artifact` — queue `realtime`

**Inputs:** `workspace_id`, `kind`, `mode`, `options`, `seed_from_attempt_id?`

**Steps:**
1. Insert `exam_artifacts` row with `status='generating'`.
2. Pull source chunks for the workspace (top-K by representativeness if total > 500).
3. Build prompt for the kind (templates in `orchestrator/templates/exam/`).
4. Call orchestrator with the kind's task taxonomy (e.g., `exam.cheatsheet`).
5. Stream tokens; for sectioned payloads, emit `artifact:delta { delta_kind, delta }` per section.
6. Validate JSON against the kind's Pydantic schema. Retry once with corrective prompt on parse fail.
7. Persist payload, set `status='ready'`. Emit `artifact:complete`.

**Retry:** 1× internal (corrective prompt). No external retry — user retries from UI.

**Mode:** `mode` is captured in `generated_in_mode`. Default Ulzii for cheatsheet/concept_map/knowledge_graph; Obama only if user explicitly switches.

---

### `signals.refresh` — queue `background`, beat: `0 */6 * * *`

Runs at 00:00, 06:00, 12:00, 18:00 UTC.

**Steps:** see `04-widgets.md` §5.

Per cycle:
- Generates a new `cycle_id` (uuid).
- Inserts up to 18 fresh signals (3 per category × 6 categories).
- Emits `cycle:refreshed { cycle_id }` on the `/signals` namespace to all connected sockets.

**Failure handling:** per-category failure is isolated — other categories still publish. If all 6 fail, emit a `system:notice` to both users: "signals are quiet right now — check back in a few hours."

---

### `signals.expire_cleanup` — queue `background`, beat: hourly

Delete signals where `expires_at < now() AND id NOT IN (SELECT signal_id FROM signal_pins)`. Embeddings cascade.

---

### `memory.consolidate` — queue `background`, beat: `0 3 * * *` (per user tz, scheduled in user-local time)

**Steps:**
1. For each user, pull memories from past 24h where `superseded_by IS NULL AND NOT forgotten`.
2. Cluster by cosine similarity > 0.85 (greedy single-pass).
3. For each cluster of size ≥ 2:
   - Call Sonnet (`memory.consolidate`) with the cluster members.
   - Receive a single canonical statement + which members it preserves.
   - Insert canonical, mark old members `superseded_by = canonical.id`.
4. Run salience decay: `UPDATE memories SET salience = salience * 0.97 WHERE last_used_at < now() - interval '1 day'`.

---

### `together.prompt_scheduler` — queue `background`, beat: every 15 min

For Esui:
- Check activity (presence on `/chat`, `/vault`, `/signals` namespaces).
- Check low-intensity heuristic (not on `/exam`, no chat msg in 90s, no upload in 5m).
- Check cooldown (`together:cooldown:<esui_id>` key absent).
- Check eligible Badrushk photos (≥ 3 unused in last 7d).
- If all yes: 30% chance roll. On hit:
  - Insert `together_prompts` row (status='pending', shown_to_user=esui).
  - Emit `prompt:appear` on `/together`.
  - Set `together:cooldown:<esui_id>` for 6h.

---

### `vault.semantic_link` — queue `background`

**Inputs:** `vault_document_id`

Triggered after a vault doc's chunks are ready.
1. Compute mean chunk embedding (or first-chunk embedding if doc is short).
2. Cosine search against other vault_chunks; group by document; pick top-5 documents above 0.78 threshold.
3. Insert `vault_links` rows with `kind='semantic'`, `strength=cosine`. Bidirectional (one row each direction).

---

### `vault.tag` — queue `background`

**Inputs:** `vault_document_id`

Calls Haiku with the doc's full content. Returns 0–5 tags. Inserts into `vault_tags` with `source='ai'`.

---

### `chat.embed_message` — queue `background`

**Inputs:** `message_id`

Embeds the message text and inserts into `message_embeddings`. Skipped for messages < 30 chars.

---

### `chat.auto_title` — queue `background`

**Inputs:** `conversation_id`

Triggered after the third turn (or first turn if user message is long). Calls Haiku with the opening exchange, gets a 4–6 word title, writes to `conversations.title`.

---

### `memory.add_from_chat` — queue `background`

**Inputs:** `user_id`, `conversation_id`, `user_text`, `ai_text`

Wraps the Mem0 `add` call. Mem0 internally extracts facts via Haiku, dedupes against existing memories, and writes to the `memories` table via our adapter.

---

### `cleanup.r2_orphans` — queue `background`, beat: weekly (`0 4 * * 0`)

Compares R2 listing against `files.r2_key`. Deletes orphans older than 7 days. Logs report to stdout.

---

### `cleanup.expired_auth` — queue `background`, beat: hourly

Deletes `auth_tokens` and `magic_links` past expiry. Lightweight.

---

### `me.export` — queue `background`

**Inputs:** `user_id`

1. Walk all owned rows (conversations, messages, vault, exam, together, signals, memories).
2. Serialize to JSON files in a temp dir.
3. Copy R2 file objects belonging to user to a temp prefix.
4. Zip everything.
5. Upload zip to `exports/{user_id}/{export_id}.zip` with 7d lifecycle.
6. Email signed download URL via Resend.

---

## 3. Beat schedule (canonical)

```
together.prompt_scheduler  — */15 * * * *           (every 15 min)
signals.refresh            — 0 */6 * * *            (every 6h)
signals.expire_cleanup     — 0 * * * *              (hourly)
memory.consolidate         — 0 3 * * *              (daily, scheduled per user-tz)
cleanup.r2_orphans         — 0 4 * * 0              (Sundays 04:00)
cleanup.expired_auth       — 0 * * * *              (hourly)
```

On-demand tasks (`ingest.*`, `composite.compose`, `exam.generate_artifact`, `me.export`, etc.) are not in beat — they're enqueued by API handlers.

---

## 4. Idempotency

All tasks are idempotent on `(input, attempt)`. Mechanisms:
- **DB unique constraints** — chunks unique on `(file_id, chunk_index)`; magic_links unique on token_hash.
- **R2 key uniqueness** — sha256-derived where applicable.
- **Status guards** — at task start, check the row's status; bail with `noop` if already `ready` or in a terminal state.

A re-run after partial failure picks up cleanly.

---

## 5. Observability

Every task:
- Logs to stdout in structured form (JSON) — captured by Fly.io log shipper.
- Logs AI calls to `ai_calls` (if any).
- Emits Socket.io progress events for user-visible flows.

Failures with exception traces go to a centralized log stream + Sentry (optional).

There is no separate ops dashboard for v1 — the settings page surfaces a tiny "system status" card with last-cycle times for periodic tasks (queried from a `system_status` view that reads `MAX(created_at)` per task name).

---

## 6. Backpressure & rate limits

External APIs have hard limits — we respect them in code:

| API           | Limit (assumed)           | Strategy                                                            |
|---------------|---------------------------|---------------------------------------------------------------------|
| Anthropic     | per-key TPM (tier-based)  | LiteLLM router handles 429s via retry + fallback                    |
| Voyage        | 300 RPM / 1M TPM          | Token bucket in `integrations/voyage.py`; batch 16 chunks/request   |
| Remove.bg     | 50 calls/min (paid)       | Token bucket; queue overflow waits up to 60s before failing         |
| Stability AI  | 150 RPM                   | Token bucket; FAL fallback on 429                                   |
| FAL.ai        | per-plan                  | Used only as fallback                                                |
| unstructured.io | per-plan                | Configurable concurrency via `UNSTRUCTURED_CONCURRENCY` env         |

Token buckets are Redis-backed (`ratelimit:ext:<api>` keys) so multiple workers share state.

---

## 7. Task priorities

Within `realtime`:
- `composite.compose` (priority 8) — user-visible, gallery moment
- `ingest.parse_and_embed` (priority 6) — blocks chat retrieval if user just attached a file
- `exam.generate_artifact` (priority 5) — user is waiting but expecting longer

Within `background`:
- `signals.refresh` (priority 5)
- `memory.consolidate` (priority 3)
- `cleanup.*` (priority 1)

Celery `task_default_priority = 4`; higher number = sooner.
