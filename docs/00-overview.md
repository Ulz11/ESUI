# ESUI — System Overview

ESUI is a private AI workspace for two users (Esui and Badrushk). Five widgets share one memory layer: Chat, Exam, Vault, Together Photos, Signals. Two AI personas (Ulzii Mode, Obama Mode) reshape how every widget thinks.

This doc maps the system end to end. Subsequent docs detail each layer.

---

## 1. Architecture style

**Modular monolith.** One FastAPI process serves all widgets. Internal modules communicate by direct call, not by network. Same Postgres, same Redis, same Celery worker pool.

Why:
- Two users. No scaling pressure that justifies microservices.
- Cross-widget memory retrieval is the central feature; service boundaries would fragment it.
- Faster to ship, easier to refactor when patterns emerge.

The only out-of-process work is asynchronous and obvious: Celery handles ingestion, photo compositing, signal refresh, and memory consolidation. The web tier never blocks on these.

---

## 2. Service map

```
            ┌──────────────────────────────────────┐
            │              Web (Next.js)           │
            │   five widget routes, single shell   │
            └───────┬───────────────────┬──────────┘
                    │ HTTPS REST        │ WebSocket (Socket.io)
                    ▼                   ▼
            ┌──────────────────────────────────────┐
            │            FastAPI (api)             │
            │  ┌──────────┬──────────┬──────────┐  │
            │  │ widgets  │ orchestr.│  ingest  │  │
            │  │  layer   │   ator   │   layer  │  │
            │  └────┬─────┴────┬─────┴────┬─────┘  │
            │       │          │          │        │
            │       │   ┌──────┴──────┐   │        │
            │       │   │  LiteLLM    │   │        │
            │       │   │   router    │   │        │
            │       │   └──────┬──────┘   │        │
            └───────┼──────────┼──────────┼────────┘
                    │          │          │
            ┌───────┴───┐  ┌───┴───┬──────┴────┐
            ▼           ▼  ▼       ▼           ▼
        Anthropic   Gemini   Kimi   Voyage  unstructured
         Claude    3.1 Pro  (chat) (embed)    (parse)

        ┌─────────────────────────────────────────┐
        │          Postgres 16 (+ pgvector)       │
        │   users, conversations, vault, memory,  │
        │   exam, together, signals, embeddings   │
        └─────────────────────────────────────────┘

        ┌──────────────┐    ┌────────────────────┐
        │    Redis     │    │  Cloudflare R2     │
        │ cache + ws   │    │  files + photos    │
        │ pub/sub +    │    │  + composites      │
        │ celery broker│    │                    │
        └──────────────┘    └────────────────────┘

        ┌──────────────────────────────────────────┐
        │       Celery worker pool + beat          │
        │  ingest, composite, signal-refresh,      │
        │   memory-consolidate, prompt-scheduler   │
        └─────────────┬──────────────┬─────────────┘
                      │              │
                      ▼              ▼
              Remove.bg /        external news +
              Stability /        philosophy feeds
              FAL.ai             (signals)
```

---

## 3. Module boundaries inside FastAPI

```
app/
  widgets/      ← thin REST handlers, one file per widget
    chat.py
    vault.py
    exam.py
    together.py
    signals.py
  orchestrator/ ← AI orchestration (mode logic, router, retrieval)
    modes.py
    router.py
    retrieval.py
    streaming.py
    tools.py
  memory/       ← Mem0 wrapper + pgvector queries
    engine.py
    consolidate.py
    adapter.py     # Mem0 → Postgres adapter
  ingest/       ← document parsing + chunking + embedding
    parse.py
    chunk.py
    embed.py
  realtime/     ← Socket.io gateway
    server.py
    rooms.py
    presence.py
  integrations/ ← external API clients
    anthropic.py
    gemini.py
    moonshot.py
    voyage.py
    removebg.py
    stability.py
    fal.py
    resend.py
    unstructured.py
  jobs/         ← Celery task definitions
    ingest.py
    composite.py
    signals.py
    memory.py
    together.py
    cleanup.py
  core/         ← cross-cutting (db, auth, config, logging)
    db.py
    auth.py
    config.py
    log.py
    errors.py
    schemas.py     # shared Pydantic models
  main.py
```

Each `widgets/*.py` is a thin controller. Real logic lives in `orchestrator/`, `memory/`, `ingest/`. This keeps widgets simple and shareable.

---

## 4. The two cross-cutting layers everything uses

### Memory layer
Every widget reads from and writes to memory. Memory is not a feature; it is the substrate.

- **Conversation memory** — Mem0 extracts facts from chat turns ("Esui is studying real analysis", "Badrushk decided on Postgres for ESUI")
- **Document memory** — Vault chunks + uploaded files, embedded with Voyage AI
- **Signal pins** — saved signals, embedded
- **Exam artifacts** — generated cheatsheets, concept maps, embedded for re-use

All four are stored in Postgres with `vector(1024)` columns and HNSW indexes. A unified retrieval function takes (query, user_id, mode, scope) and returns the top-k items across all sources, re-ranked.

### Orchestration layer
Every AI call routes through one entry point: `orchestrator.run(task, mode, context)`. This:
1. Selects the model via LiteLLM router based on task taxonomy.
2. Builds the system prompt from the mode (Ulzii or Obama).
3. Retrieves relevant memory and injects it.
4. Calls the model with prompt caching enabled.
5. Streams tokens back via async generator.
6. Logs the call (tokens, latency, cost) to `ai_calls`.
7. Writes new memories from the conversation back via Mem0.

No widget calls a model directly. Always through the orchestrator.

---

## 5. Tech stack rationale

| Choice                         | Why                                                                                          |
|--------------------------------|----------------------------------------------------------------------------------------------|
| Next.js 14 App Router          | Streaming-first React, server components reduce client JS, Vercel deploy is one command      |
| FastAPI                        | Async-native, Pydantic v2 contracts double as API docs, Python ecosystem for AI/ML libs      |
| Postgres 16 + pgvector         | One database for relational + vector. HNSW indexes are fast at this scale (10K–100K vectors) |
| Redis                          | Socket.io adapter, Celery broker, ephemeral cache (signal feed, mode session state)          |
| Celery                         | Mature Python job queue. Beat handles cron schedules (signal refresh, memory consolidation)  |
| Cloudflare R2                  | S3-compatible, no egress fees, enough for two-user photo gallery                             |
| LiteLLM                        | One client, three model families, automatic streaming + retry + cost tracking                |
| Mem0                           | Battle-tested fact extraction from chat. Plugs into our pgvector via custom adapter          |
| unstructured.io                | Best-in-class PDF/doc parsing with section structure preserved                               |
| Voyage AI (voyage-3)           | Anthropic's recommended embedding model. 1024-dim, strong on long-context retrieval          |
| python-socketio                | Realtime: rooms, presence, reconnection, typing — built rather than reinvented               |

---

## 6. Operating principles

- **Memory-first.** No blank-context AI calls. Every call is grounded in retrieved memory.
- **Mode shapes everything.** Mode is not just a system prompt — it changes which models are preferred, how retrieval is weighted, what tools are exposed.
- **Streaming is the default.** Every AI response streams. No spinners.
- **Graceful by design.** Skeletons for every loading state. Warm error messages. Together prompts that disappear softly.
- **Two users, no more.** Auth is allowlist + magic link. Authorization is "is this user one of the two?" — no role explosions.
- **Privacy is structural.** Files are private to owner; only Vault items explicitly shared cross-user are visible to both. The system never leaks one user's private memory into the other's prompts.

---

## 7. What this doc does not cover

→ See `01-data.md` for full Postgres schema and pgvector setup.
→ See `02-api.md` for HTTP and WebSocket contracts.
→ See `03-ai.md` for mode prompts, model routing, retrieval pipeline.
→ See `04-widgets.md` for per-widget behavior and edge cases.
→ See `05-jobs.md` for Celery task catalog.
→ See `06-deploy.md` for project layout, env, hosting, secrets.
