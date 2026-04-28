# ESUI — API Surface

REST endpoints + Socket.io events. All REST is prefixed `/api/v1/`. Auth is a `Bearer <token>` header on every request except `/auth/*`.

Pydantic v2 models double as OpenAPI schema; the frontend types are codegen'd from `/openapi.json` at build time.

---

## 0. Conventions

- Cursors are opaque base64 strings. Default page size is 50.
- Timestamps are ISO 8601 in UTC.
- `404` for missing resources, `403` for cross-user access, `429` for rate-limited.
- Errors return `{ error: { code, message, hint? } }`.
- WebSocket payloads are JSON. Each event has a stable `type` field on the wire.

---

## 1. Auth

| Method | Path                  | Body / Query                   | Returns                                  |
|--------|-----------------------|--------------------------------|------------------------------------------|
| POST   | `/auth/magic-link`    | `{ email }`                    | `204` (silently 204 even if not allowlisted) |
| POST   | `/auth/verify`        | `{ email, token }`             | `{ access_token, expires_at, user }`     |
| GET    | `/auth/me`            | —                              | `{ user }`                               |
| POST   | `/auth/logout`        | —                              | `204`                                    |

Magic links expire in 15 min. Access tokens are JWT, 30-day expiry, refreshed on use (rolling).

---

## 2. Conversations & Messages

| Method | Path                                         | Body / Query                                                   | Returns                                |
|--------|----------------------------------------------|----------------------------------------------------------------|----------------------------------------|
| GET    | `/conversations`                             | `?archived=false&cursor=&limit=50`                             | `{ conversations, next_cursor }`       |
| POST   | `/conversations`                             | `{ title?, pinned_context?, invite_partner?: bool }`           | `{ conversation }`                     |
| GET    | `/conversations/:id`                         | —                                                              | `{ conversation, participants, branches }` |
| PATCH  | `/conversations/:id`                         | `{ title?, pinned_context?, archived? }`                       | `{ conversation }`                     |
| DELETE | `/conversations/:id`                         | —                                                              | `204`                                  |
| GET    | `/conversations/:id/messages`                | `?branch=:id&before=:cursor&limit=50`                          | `{ messages, next_cursor }`            |
| POST   | `/conversations/:id/messages`                | `{ content_blocks, mode, parent_message_id?, attached_file_ids?, model_hint? }` | `{ message }` (then streams over WS) |
| POST   | `/conversations/:id/branch`                  | `{ from_message_id }`                                          | `{ branch_id, root_message_id }`       |
| POST   | `/conversations/:id/search`                  | `{ query, limit?: 20 }`                                        | `{ messages }` (semantic search)       |
| POST   | `/conversations/:id/messages/:mid/cancel`    | —                                                              | `{ status: 'cancelled' \| 'too_late' }` |

**Note:** `POST /messages` returns the persisted user message immediately. The AI turn is delivered over WebSocket. Clients that are not connected to WS will see the AI message appear after reconnecting via `GET /messages`.

---

## 3. Files

| Method | Path                                | Body / Query             | Returns                          |
|--------|-------------------------------------|--------------------------|----------------------------------|
| POST   | `/files`                            | multipart `file`         | `{ file, upload_id }`            |
| GET    | `/files/:id`                        | —                        | `{ file }`                       |
| POST   | `/files/:id/url`                    | —                        | `{ signed_url, expires_at }`     |
| DELETE | `/files/:id`                        | —                        | `204`                            |
| GET    | `/files`                            | `?kind=&owner=me&cursor=`| `{ files, next_cursor }`         |

Uploads stream to R2 via a signed PUT URL when > 4MB; small files post directly to FastAPI which proxies to R2.

---

## 4. Vault

| Method | Path                                   | Body / Query                                       | Returns                                         |
|--------|----------------------------------------|----------------------------------------------------|-------------------------------------------------|
| GET    | `/vault/documents`                     | `?q=&tag=&content_type=&shared=&cursor=&limit=`    | `{ documents, next_cursor }`                    |
| POST   | `/vault/documents`                     | `{ title, content_md, content_type?, shared?: false }` | `{ document }`                              |
| GET    | `/vault/documents/:id`                 | —                                                  | `{ document, tags, links }`                     |
| PATCH  | `/vault/documents/:id`                 | `{ title?, content_md?, content_type?, shared?, archived? }` | `{ document }`                        |
| DELETE | `/vault/documents/:id`                 | —                                                  | `204`                                           |
| POST   | `/vault/search`                        | `{ query, limit?: 10, mode?: 'hybrid'\|'semantic' }` | `{ hits: [{ document, snippet, score }] }`    |
| POST   | `/vault/import-file`                   | `{ file_id, content_type? }`                       | `{ document }` (ingest async)                   |
| GET    | `/vault/graph`                         | `?center=:doc_id&depth=2&max_nodes=80`             | `{ nodes, edges }`                              |
| POST   | `/vault/documents/:id/tags`            | `{ tag }`                                          | `204`                                           |
| DELETE | `/vault/documents/:id/tags/:tag`       | —                                                  | `204`                                           |
| POST   | `/vault/documents/:id/links`           | `{ target_doc_id, note? }`                         | `{ link }` (kind='explicit')                    |
| DELETE | `/vault/links/:id`                     | —                                                  | `204`                                           |

---

## 5. Exam

| Method | Path                                          | Body / Query                                              | Returns                                          |
|--------|-----------------------------------------------|-----------------------------------------------------------|--------------------------------------------------|
| GET    | `/exam/workspaces`                            | `?cursor=&limit=`                                         | `{ workspaces, next_cursor }`                    |
| POST   | `/exam/workspaces`                            | `{ title, subject? }`                                     | `{ workspace }`                                  |
| GET    | `/exam/workspaces/:id`                        | —                                                         | `{ workspace, sources, artifacts }`              |
| DELETE | `/exam/workspaces/:id`                        | —                                                         | `204`                                            |
| POST   | `/exam/workspaces/:id/sources`                | `{ file_id }`                                             | `{ source }` (ingest async)                      |
| DELETE | `/exam/workspaces/:id/sources/:source_id`     | —                                                         | `204`                                            |
| POST   | `/exam/workspaces/:id/generate`               | `{ kind, mode, options? }`                                | `{ artifact_id, status: 'generating' }` (streams)|
| GET    | `/exam/artifacts/:id`                         | —                                                         | `{ artifact }`                                   |
| POST   | `/exam/artifacts/:id/regenerate`              | `{ mode?, options? }`                                     | `{ artifact_id }`                                |
| POST   | `/exam/artifacts/:id/attempt`                 | `{ responses, duration_sec }`                             | `{ attempt }`                                    |
| GET    | `/exam/artifacts/:id/attempts`                | —                                                         | `{ attempts }`                                   |

`options` per kind:
- `cheatsheet`: `{ depth: 'tight'\|'thorough', focus_topics?: string[] }`
- `practice_set`: `{ n_questions: 10, difficulty: 'mixed'\|'easy'\|'hard', seed_from_attempt_id? }`
- `simulation`: `{ duration_min: 90, n_questions: 12, rubric_mode: 'ai-grade'\|'self' }`

---

## 6. Together Photos

| Method | Path                                       | Body / Query                                  | Returns                              |
|--------|--------------------------------------------|-----------------------------------------------|--------------------------------------|
| GET    | `/together/prompts/current`                | —                                             | `{ prompt? \| null }`                |
| POST   | `/together/prompts/:id/skip`               | —                                             | `{ warm_message }`                   |
| POST   | `/together/prompts/:id/accept`             | `{ esui_photo_file_id, scene_hint? }`         | `{ photo_id, status: 'queued' }`     |
| GET    | `/together/photos`                         | `?cursor=&limit=`                             | `{ photos, next_cursor }`            |
| GET    | `/together/photos/:id`                     | —                                             | `{ photo }`                          |
| POST   | `/together/photos/:id/redo`                | `{ scene_hint? }`                             | `{ photo_id }`                       |
| DELETE | `/together/photos/:id`                     | —                                             | `204`                                |
| GET    | `/together/eligible`                       | —                                             | `{ files }` (Badrushk's eligible photos)  |
| POST   | `/together/eligible/:file_id`              | `{ eligible: bool }`                          | `204`                                |

`/together/prompts/current` is polled by the client on a soft cadence (every 60s) AND pushed via `prompt:appear` socket event.

---

## 7. Signals

| Method | Path                                  | Body / Query                  | Returns                                       |
|--------|---------------------------------------|-------------------------------|-----------------------------------------------|
| GET    | `/signals/current`                    | —                             | `{ cycle_id, refreshed_at, expires_at, items }` |
| GET    | `/signals/history`                    | `?category=&cursor=&limit=`   | `{ signals, next_cursor }` (saved + last cycle's expired) |
| POST   | `/signals/:id/pin`                    | —                             | `{ vault_document_id }`                       |
| POST   | `/signals/:id/dismiss`                | —                             | `204`                                         |
| POST   | `/signals/:id/open`                   | —                             | `204`                                         |
| POST   | `/signals/:id/share-to-chat`          | `{ conversation_id }`         | `{ message_id }`                              |

---

## 8. Memory

For transparency. The user can audit, edit, or forget anything the AI remembers.

| Method | Path                          | Body / Query                                    | Returns                          |
|--------|-------------------------------|-------------------------------------------------|----------------------------------|
| GET    | `/memory`                     | `?category=&scope=&cursor=&limit=`              | `{ memories, next_cursor }`      |
| POST   | `/memory`                     | `{ text, category, scope?: 'global' }`          | `{ memory }`                     |
| PATCH  | `/memory/:id`                 | `{ text?, category?, salience? }`               | `{ memory }`                     |
| POST   | `/memory/:id/forget`          | `{ reason? }`                                   | `204`                            |
| POST   | `/memory/search`              | `{ query, limit?: 20 }`                         | `{ memories }`                   |

---

## 9. User & Settings

| Method | Path                  | Body / Query                              | Returns                |
|--------|-----------------------|-------------------------------------------|------------------------|
| GET    | `/me`                 | —                                         | `{ user, preferences }`|
| PATCH  | `/me`                 | `{ display_name?, avatar_url?, timezone?, default_mode? }` | `{ user }` |
| GET    | `/me/usage`           | `?range=30d`                              | `{ tokens, cost_cents, by_task }` |
| POST   | `/me/export`          | —                                         | `{ export_id }` (async) |
| GET    | `/me/exports/:id`     | —                                         | `{ status, download_url? }` |

---

## 10. WebSocket events (Socket.io)

Connection: `wss://api.esui.app/socket.io/` with `auth: { token }` payload on handshake. Server validates JWT and attaches `user_id` to the socket.

Namespaces: `/chat`, `/together`, `/exam`, `/signals`, `/system`.

### `/chat`

Client → server:

| Event                  | Payload                                                                                              |
|------------------------|------------------------------------------------------------------------------------------------------|
| `conversation:join`    | `{ conversation_id }`                                                                                |
| `conversation:leave`   | `{ conversation_id }`                                                                                |
| `typing:start`         | `{ conversation_id }`                                                                                |
| `typing:stop`          | `{ conversation_id }`                                                                                |
| `message:send`         | `{ conversation_id, content_blocks, mode, parent_message_id?, attached_file_ids?, model_hint? }`     |
| `message:cancel`       | `{ message_id }`                                                                                     |

Server → client:

| Event                  | Payload                                                                                              |
|------------------------|------------------------------------------------------------------------------------------------------|
| `presence:update`      | `{ conversation_id, users: [{ user_id, last_seen_at, online }] }`                                    |
| `typing:update`        | `{ conversation_id, user_id, typing: bool }`                                                         |
| `message:created`      | `{ message }` (any new user/AI message — broadcast to room)                                          |
| `message:ai:start`     | `{ message_id, mode, model_id, retrieval_summary? }`                                                 |
| `message:ai:delta`     | `{ message_id, delta_text, delta_index }`                                                            |
| `message:ai:tool_use`  | `{ message_id, tool, args, result_preview? }`                                                        |
| `message:ai:complete`  | `{ message_id, tokens_in, tokens_out, cost_cents, cache_hit }`                                       |
| `message:ai:error`     | `{ message_id, error, retryable: bool }`                                                             |

### `/together` (Esui only in v1)

Server → client:

| Event                | Payload                                       |
|----------------------|-----------------------------------------------|
| `prompt:appear`      | `{ prompt_id, shown_at }`                     |
| `composite:progress` | `{ photo_id, step, percent }`                 |
| `composite:ready`    | `{ photo_id }`                                |
| `composite:failed`   | `{ photo_id, error }`                         |

### `/exam`

Server → client:

| Event                | Payload                                            |
|----------------------|----------------------------------------------------|
| `artifact:progress`  | `{ artifact_id, step, percent }`                   |
| `artifact:delta`     | `{ artifact_id, delta_kind, delta }` (streamed sections of the payload) |
| `artifact:complete`  | `{ artifact_id }`                                  |
| `artifact:error`     | `{ artifact_id, error }`                           |

### `/signals`

Server → client:

| Event              | Payload                                  |
|--------------------|------------------------------------------|
| `cycle:refreshed`  | `{ cycle_id, refreshed_at, expires_at }` |

### `/system`

Server → client:

| Event              | Payload                            |
|--------------------|------------------------------------|
| `ingest:progress`  | `{ file_id, step, percent }`       |
| `ingest:complete`  | `{ file_id }`                      |
| `ingest:error`     | `{ file_id, error }`               |
| `system:notice`    | `{ kind, message, dismissable }`   |

---

## 11. Content blocks (message format)

`messages.content_blocks` is a JSON array of typed blocks. Renderer maps each block to a UI component.

```ts
type Block =
  | { type: 'text'; text: string }
  | { type: 'image'; file_id: string; alt?: string }
  | { type: 'file'; file_id: string }
  | { type: 'signal_card'; signal_id: string }
  | { type: 'vault_link'; document_id: string }
  | { type: 'citation'; source_id: string; source_kind: 'vault' | 'file' | 'memory'; quote?: string }
  | { type: 'tool_call'; tool: string; args: object; result_preview?: string }
  | { type: 'thinking'; text: string }    // Anthropic extended thinking traces, optional render
```

Streaming AI messages append to a single `text` block by default; the server may emit additional blocks (`tool_call`, `citation`) as separate items.

---

## 12. Rate limits

| Bucket                            | Limit             |
|-----------------------------------|-------------------|
| `/auth/magic-link` per email      | 5 per hour        |
| `/auth/verify` per email          | 10 per hour       |
| `message:send` per user           | 60 per minute     |
| `/files` upload per user          | 30 per minute, 5GB per day |
| `/exam/.../generate` per user     | 20 per hour       |
| `/together/prompts/:id/accept` per user | 10 per hour |
| `/vault/search` per user          | 120 per minute    |

Returns `429` with `Retry-After` header.

---

## 13. OpenAPI / TypeScript codegen

FastAPI emits `/openapi.json`. A build script in `scripts/codegen-types.sh` runs `openapi-typescript` to produce `packages/shared/src/api.ts`. Both web and api import from the same shape source.
