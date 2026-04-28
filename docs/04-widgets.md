# ESUI — Widget Specs

Each widget is a UI surface plus a thin REST/WS layer plus calls into the orchestrator + memory + ingest layers.

This doc specifies behavior, key flows, edge cases, and any widget-specific data shapes. It is behavior-only — visual design lives elsewhere.

---

## 1. Chat

### Purpose
Persistent, dual-user, AI-mediated conversation with full memory recall and file context.

### Core flows

**Send a message**
1. Client emits `message:send` over Socket.io with `content_blocks` + `mode`.
2. Server persists user message (`status='complete'`), broadcasts `message:created` to the room.
3. Server begins AI turn (see `03-ai.md` §10):
   - Build retrieval block
   - Select model
   - Persist placeholder AI message (`status='streaming'`)
   - Emit `message:ai:start { message_id, mode, model_id }`
   - Stream tokens → emit `message:ai:delta` per chunk
   - On end: persist content, emit `message:ai:complete`
   - Async: kick off Mem0 write + embedding + auto-title (if first 3 turns)

**Branching**
1. Client calls `POST /conversations/:id/branch { from_message_id }`.
2. Server creates a new `branch_id`, derives the lineage, returns `{ branch_id, root_message_id }`.
3. Subsequent `message:send` events on the new branch carry the new `branch_id`.
4. Listing a conversation accepts `?branch=:id`. UI renders branches as a parallel timeline; switching branches is a list filter.

**Real-time presence and typing**
- Socket joins room `conversation:<id>` on `conversation:join`.
- `presence:update` emitted on join/leave (Redis hash mutations under `presence:<conv_id>`).
- `typing:start` sets `typing:<conv_id>:<user_id> = 1` with 5s TTL → emit `typing:update`. `typing:stop` deletes the key.

**Pinned context**
- `conversation.pinned_context` is plain text. Edited via PATCH. Always injected into the system prompt below the mode preamble. Caches well.

**Auto-title**
- After turn 3 (or earlier if conversation contains a long opening message), Haiku summarizes into a 4–6 word title and writes to `conversations.title`.

### File attachment
- Client uploads via `POST /files` (multipart) → returns `file`.
- Client includes `file_id` in `attached_file_ids` of `message:send`.
- Server adds entries to `message_files`.
- Ingest is triggered if the file is new (kind in `pdf|doc`). The AI turn waits up to 8s for ingest; if not ready, proceed with raw native input (Anthropic supports PDF natively up to 32MB).

### Search
- `POST /conversations/:id/search { query }` runs vector search over `message_embeddings` filtered by `conversation_id`. Returns top-20 messages with surrounding context.

### Edge cases
- **Both users typing:** show two typing indicators side by side.
- **Both users send simultaneously:** server orders by receipt timestamp; AI responds to the most recent (latest context).
- **AI cancellation mid-stream:** `message:cancel` triggers upstream cancel; persists what was generated; cost still logged.
- **User edits a sent message:** not supported in v1. Branching is the offered path.
- **Disconnection:** server keeps generating; on reconnect, client refetches messages from `before_cursor` of last seen.
- **Long quotes / code blocks:** content_blocks support `text` with markdown; very long code blocks are stored inline (no special storage).

### REST surface
See `02-api.md` §2.

---

## 2. Exam

### Purpose
Compress study materials into intelligence-dense artifacts.

### Core flow

1. Esui creates a workspace (subject + title).
2. She adds source files (lecture notes, readings).
3. Sources ingest in background → `file_chunks` populated.
4. She picks an artifact kind and clicks Generate.
5. Server orchestrates artifact generation, streams progress + delta over `/exam` socket.
6. Artifact is persisted to `exam_artifacts.payload`.

### Artifact payload shapes

**Cheatsheet** (`kind='cheatsheet'`)
```json
{
  "version": 1,
  "sections": [
    {
      "title": "Definitions",
      "items": [
        { "term": "Cauchy sequence",
          "definition": "...",
          "source_chunks": ["chunk-uuid-1"] }
      ]
    },
    {
      "title": "Theorems",
      "items": [
        { "name": "Bolzano-Weierstrass",
          "statement": "...",
          "intuition": "...",
          "proof_sketch": "...",
          "source_chunks": ["..."] }
      ]
    },
    { "title": "Pitfalls", "items": [...] },
    { "title": "Worked Examples", "items": [...] }
  ],
  "density_score": 0.87,
  "generated_at": "2026-04-26T..."
}
```

**Concept Map** (`kind='concept_map'`)
```json
{
  "version": 1,
  "nodes": [
    { "id": "n1", "label": "Continuity", "kind": "concept", "depth": 0 },
    { "id": "n2", "label": "Uniform Continuity", "kind": "concept", "depth": 1 }
  ],
  "edges": [
    { "from": "n2", "to": "n1", "label": "specializes" },
    { "from": "n1", "to": "n3", "label": "implies" }
  ],
  "layout_hint": "hierarchical"
}
```

**Practice Set** (`kind='practice_set'`)
```json
{
  "version": 1,
  "questions": [
    {
      "id": "q1",
      "type": "short_answer",
      "prompt": "State the ε-δ definition of continuity at a point.",
      "expected": "...",
      "rubric": "1pt for ε, 1pt for δ, 1pt for the implication chain",
      "difficulty": 0.5,
      "topic": "ε-δ continuity"
    },
    {
      "id": "q2",
      "type": "mcq",
      "prompt": "Which of the following is NOT continuous?",
      "choices": ["...", "...", "...", "..."],
      "correct_index": 2,
      "difficulty": 0.3,
      "topic": "continuity"
    }
  ],
  "calibration": {
    "topics_covered": ["ε-δ continuity", "uniform continuity"],
    "weak_topics_seeded_from_attempt_id": null
  }
}
```

**Knowledge Graph** (`kind='knowledge_graph'`) — Voronoi-style
```json
{
  "version": 1,
  "regions": [
    { "id": "r1", "label": "Real Analysis", "color": "navy" }
  ],
  "nodes": [
    { "id": "n1", "label": "Compactness", "x": 0.32, "y": 0.51,
      "region": "r1", "weight": 0.9, "summary": "..." }
  ],
  "edges": [
    { "from": "n1", "to": "n2", "kind": "prereq" },
    { "from": "n3", "to": "n1", "kind": "supports" }
  ]
}
```
Voronoi layout is computed client-side from `nodes.weight` × `region` centroids; the server provides positions as hints, not constraints.

**Simulation** (`kind='simulation'`)
```json
{
  "version": 1,
  "config": {
    "duration_min": 90,
    "n_questions": 12,
    "rubric_mode": "ai-grade"
  },
  "questions": [...],   // same shape as practice_set
  "instructions": "..."
}
```

### Generation
Each kind has a dedicated orchestrator path that:
- Pulls all `file_chunks` for the workspace's sources (or top-K representative chunks if total > 500).
- Builds a structured prompt with explicit JSON output schema (Anthropic's tool-use forced JSON or Pydantic-validated).
- Calls the model via the orchestrator (see `03-ai.md` §2 task table).
- Parses + validates against the schema; retries once on parse fail with a corrective prompt.
- Streams progress (`artifact:progress` per section/chunk) and `artifact:delta` for partial payload updates so the UI can render as it builds.

### Adaptive practice
On `POST /exam/artifacts/:id/attempt`:
1. Server records `responses + duration_sec`.
2. AI grades (Sonnet `exam.grade`) per question against rubric.
3. Builds `weak_topics` array `[{topic, confidence}]` (confidence < 0.6 = weak).
4. Persists attempt.
5. Next `practice_set` regeneration with `seed_from_attempt_id` biases question generation toward weak topics (rough split: 60% weak, 30% adjacent, 10% review).

### Edge cases
- **Source set too large:** if total chunks > 500, retrieval-pre-filter to top-200 by representativeness (k-medoids cluster sample) before generating.
- **Mixed languages in sources:** detected at parse time; cheatsheet preserves source language by default with optional translation toggle.
- **Mid-generation cancel:** discarded; partial artifact not persisted (status='error', error='cancelled').
- **JSON validation fails twice:** persist with `status='error'`, message: "the model returned malformed output — try again." Don't auto-retry endlessly.

---

## 3. Vault

### Purpose
Personal knowledge repository. Semantic search. Knowledge graph. Auto-organization.

### Core flows

**Create / edit a note**
- Markdown editor on the client, autosave on idle (1s) and on blur.
- On save: server writes `vault_documents`, kicks off async:
  - chunk + embed (`vault_chunks`)
  - tag (Haiku → `vault_tags` with `source='ai'`, max 5 tags)
  - title generation (Haiku) if title is empty
  - link discovery (Haiku → `vault_links` with `kind='semantic'`): for each new doc, find top-5 cosine neighbors above 0.78 threshold, write links bidirectionally

**Import from file**
- `POST /vault/import-file { file_id }` → ingest pipeline produces a `vault_document` with `content_md` extracted from parsed sections, plus chunks. Title defaults to filename; user can rename.

**Semantic search**
- `POST /vault/search { query, mode? }`:
  1. Embed query (voyage).
  2. Hybrid (default): top-30 by cosine on `vault_chunks` UNION top-30 by `pg_trgm` on `title || content_md`.
  3. Merge by `document_id`, rerank by `max(chunk_score) + 0.1 * title_match`.
  4. Return top-10 with snippets (chunk text ± 50 chars context).
- `mode='semantic'` skips the trigram path.

**Knowledge graph**
- `GET /vault/graph?center=:doc_id&depth=2`:
  - BFS through `vault_links` up to depth, max 80 nodes.
  - Node payload: `{ id, title, tags[], updated_at, content_type }`.
  - Edge payload: `{ source, target, kind, strength, note? }`.
  - Layout is client-side (force-directed).
- Without `center`, returns the user's "home" graph: top-50 most-recently-updated docs and their links.

**Sharing**
- `vault_documents.shared = true` makes the doc visible in the partner's Vault.
- Shared docs show authorship in UI.
- Search (and retrieval for chat) across shared docs uses the union of (mine ∪ partner's `shared=true`).

### Edge cases
- **Bulk import:** on a folder of 50 PDFs, ingest queues with priority `vault_import` so it doesn't starve chat.
- **Edit during ingest:** lock the document for chunk regeneration; UI shows a small "indexing…" indicator. Subsequent searches use stale chunks until ready.
- **Tag noise:** Haiku tagging caps at 5 tags per doc; user can edit. Tag normalization (lowercased, hyphenated) on insert.
- **Link cycles:** `vault_links` unique constraint on (source, target, kind) prevents duplicate edges; cycles are fine in the graph.
- **Deletion:** cascades to chunks, tags, links. Linked-from edges from other docs are also dropped (via FK ON DELETE CASCADE).

---

## 4. Together Photos

### Purpose
Composited "as if" photos of Esui and Badrushk together. Personal. Intimate. Low-key.

### Lifecycle

```
Esui working in workspace (low-intensity session)
  ↓ scheduler emits prompt
prompt:appear (Esui only)
  ↓ Esui uploads her photo (or skips → warm message → done)
POST /together/prompts/:id/accept { esui_photo_file_id, scene_hint? }
  ↓ enqueue: composite.compose
1. Pick a Badrushk photo at random from
   files where together_eligible AND owner=badrushk AND not used in last 7 days
2. Generate scene_prompt via Sonnet (together.scene_prompt) given:
   - both photos' EXIF + a quick vision pass for environment hints
   - scene_hint (if provided)
   - past 5 scene prompts (avoid repetition)
   - season, day-of-week (mood)
3. Remove.bg on both photos → R2 intermediates
4. Stability AI compositor: scene + two subjects (ControlNet) → R2 composite
   Fallback: FAL.ai Flux with same inputs
5. Save together_photo (status='ready', composite_file_id)
  ↓ emit composite:ready over /together socket
Esui sees the new photo in her gallery
```

### Scheduler logic

`together.prompt_scheduler` Celery task runs **every 15 min**.

For Esui:
- Has she been active in the last 30 min? (presence on `/chat`, `/vault`, or `/signals` namespaces — `presence:*:<esui_id>` recent)
- Is she in a "low-intensity" session?
  - NOT currently on `/exam` namespace
  - hasn't sent a chat message in last 90s
  - no file upload in last 5 min
- Has the cooldown expired? `together:cooldown:<esui_id>` not set
- Are there ≥ 3 unused Badrushk eligible photos (not used in last 7d)?
- If all conditions yes: roll a 30% chance per check; on hit:
  - Create a `together_prompts` row (status='pending')
  - Emit `prompt:appear` on the `/together` namespace
  - Set `together:cooldown:<esui_id>` for 6h

### Skip → warm message

Pool of warm messages (round-robin across recent shows, tracked in `together:warm_msg_recent:<user_id>`):
- "saved for later — he's thinking of you"
- "maybe tonight — the moment will wait"
- "no rush. the gallery will still be here."
- "another time — today is yours"

`POST /together/prompts/:id/skip` returns `{ warm_message }`. UI shows it inline for 2.5s, then dismisses.

### Compositing detail

**Scene prompt generation (Sonnet):**
```
Inputs:
  - photo A (Esui): vision-extracted environment hints (lighting, indoor/outdoor, time)
  - photo B (Badrushk): same
  - past 5 scene_prompts (avoid)
  - season + day-of-week
  - optional scene_hint from Esui

Output (JSON):
  {
    "scene": "1-2 sentence cinematic scene description",
    "lighting": "warm afternoon | cool morning | soft evening | ...",
    "mood": "relaxed | playful | thoughtful | ...",
    "narrative": "one short line of implied story (optional)"
  }
```

**Compositing pipeline:**
1. Remove.bg API on both photos → cutouts (PNG with alpha) → R2 intermediates.
2. Stability AI SDXL with:
   - `prompt = scene` (with style guidance: "photorealistic, natural lighting, candid")
   - ControlNet inputs: both cutouts positioned (fixed bias: Esui slightly left, Badrushk slightly right)
   - Optional: `negative_prompt` = "deformed, extra limbs, watermark"
3. On Stability fail or low-quality output (heuristic via output dimensions / NSFW flag): FAL.ai Flux fallback with same inputs.
4. Output → R2 as `together/composites/{photo_id}.png`.
5. Update `together_photos.status = 'ready'`, `composite_file_id` set.

### Edge cases
- **Esui declines repeatedly:** the scheduler doesn't shift behavior; skips are a soft preference, not a signal to stop. Rate stays at 30% per eligible check.
- **No Badrushk eligible photos:** scheduler stays quiet. Settings page nudges Badrushk to upload.
- **Composite quality bad:** UI has "redo" — same prompt, fresh seed, picks a different Badrushk photo if available.
- **Failure:** `together_photos.status = 'failed'`, error stored. Esui sees "we couldn't quite get it right" with a retry button.
- **Photo deletion:** soft-delete from gallery (UI hide); R2 object retained 30d for "undo," then GC'd by `cleanup.r2_orphans`.

---

## 5. Signals

### Purpose
Curated wisdom feed, refreshed every 6h. Six categories. Ephemeral by default.

### Categories
- `global` — what actually matters in the world (signal-to-noise > freshness)
- `tech` — technology + market developments
- `mathematics` — for human flourishing (curated math content)
- `arabic_philosophy` — classical wisdom
- `chinese_philosophy` — strategic + classical thought
- `research` — research fragments (papers, results)

### Cycle (`signals.refresh` Celery, beat: every 6h)

For each category:
1. **Pull source candidates:**
   - `global`, `tech`, `research`: RSS + curated feed list (~30 sources, configured in `core/config.py`)
   - `mathematics`: arXiv `math.*`, Quanta Magazine, MathOverflow top of week
   - `arabic_philosophy`, `chinese_philosophy`: a curated rotation of primary texts + recent secondary scholarship feeds
2. **Dedupe** via embedding cosine vs. last 7 days of signals (>0.92 = duplicate, drop).
3. **Rank candidates** by composite score:
   - source authority (1–10, hardcoded per source)
   - novelty: `1 - max(cosine vs. recent signals)`
   - per-user engagement boost: `cosine(candidate, recent_pins[user]) * pin_weight + cosine(candidate, recent_dismisses[user]) * (-dismiss_weight)`
4. **Take top-3 per category** → 18 candidates.
5. **For each, run `signals.distill` (Sonnet):** rewrite source into a 2–4 sentence signal in ESUI house voice. Output includes: `{ title, body, source_url, source_name }`.
6. **Embed each, persist** to `signals` with `expires_at = fetched_at + 24h` and `cycle_id`.
7. **Emit** `cycle:refreshed { cycle_id }` on `/signals` namespace.

### Engagement → curation feedback

`signal_engagements` rows weight future ranking. Pinning is the strongest positive signal; dismissing is a soft negative; opening is neutral-positive (a small +). Each user has personalized ranking — Esui's feed and Badrushk's feed differ by their pin/dismiss history.

### Pin → Vault

`POST /signals/:id/pin`:
1. Create a `vault_documents` row with `title=signal.title`, `content_md = signal.body + source link`.
2. Tag `signal`, `<category>`.
3. Insert `signal_pins (signal_id, user_id, vault_document_id)`.
4. The signal row's `expires_at` becomes irrelevant — pinned content lives in Vault.

### Share to chat

`POST /signals/:id/share-to-chat { conversation_id }`:
1. Build a content_block: `{ type: 'signal_card', signal_id }`.
2. Insert as a user message (no AI turn auto-triggered; user types their question next).

### Display contract

The Signals widget shows the current cycle. Categories are columns. Items are cards: `title`, 2–4 sentence body, small source attribution, three actions: Open (external — opens in new tab), Pin, Dismiss.

When a cycle refresh happens while Esui is on the Signals page, the new cycle slides in **below** the current one rather than replacing — she always controls when she moves on. Old cycle still readable until manually dismissed or expired (24h).

### Edge cases
- **All sources fail in a category:** keep the previous cycle's items for that category for one extra cycle, with a small "no fresh signals" indicator.
- **Same source surfaces twice in different categories:** dedupe globally per cycle (one canonical assignment).
- **Pinned signal expires from `signals` table:** doesn't matter — the Vault doc persists; the `signals` row is GC'd by `signals.expire_cleanup` (hourly Celery).
- **Source feed schema changes:** parser tolerant, logs a soft warning, drops offending items.

---

## 6. Settings (sub-widget within shell)

Not one of the five widgets but worth specifying.

- **Profile:** display name, avatar, timezone.
- **Default mode:** Ulzii / Obama.
- **Together eligibility:** Badrushk-only — list of his photos with toggle for `together_eligible`.
- **Memory:** browse, edit, forget. (See `02-api.md` §8.)
- **Usage:** monthly token + cost summary.
- **Export:** trigger data export.
- **Connected models:** read-only summary of which providers are active and last-call latency.

Settings UX should feel like a quiet drawer, not a separate destination.
