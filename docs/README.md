# ESUI — Architecture & System Design

ESUI is a private AI workspace for two users (Esui and Badrushk). Five widgets share one memory layer: Chat, Exam, Vault, Together Photos, Signals. Two AI personas (Ulzii Mode, Obama Mode) reshape how every widget thinks.

This `docs/` folder contains the full system design. Read in order or jump to what you need.

| #  | Document                       | What's in it                                                            |
|----|--------------------------------|-------------------------------------------------------------------------|
| 00 | [Overview](00-overview.md)     | Architecture style, service map, module boundaries, principles          |
| 01 | [Data](01-data.md)             | Postgres schema, pgvector setup, Redis keyspaces, R2 layout             |
| 02 | [API](02-api.md)               | REST endpoints + Socket.io events per widget                            |
| 03 | [AI Layer](03-ai.md)           | Mode prompts, model router, retrieval, memory engine, ingest, streaming |
| 04 | [Widgets](04-widgets.md)       | Per-widget specs: behaviors, payloads, edge cases                       |
| 05 | [Jobs](05-jobs.md)             | Celery task catalog and beat schedule                                   |
| 06 | [Deploy](06-deploy.md)         | Repo layout, env vars, hosting, CI, security                            |

## Quick principles

1. **Memory-first.** Every AI call is grounded in retrieved memory. No blank context.
2. **Mode shapes everything.** Mode determines system prompt, model selection, retrieval bias, tool palette.
3. **Streaming is the default.** No spinners. Skeletons for loading. Tokens stream as they're generated.
4. **Two users, no more.** Auth is allowlist + magic link. Authorization is "which of two."
5. **Modular monolith.** One FastAPI process. Internal module boundaries, not network boundaries.

## Stack at a glance

- **Frontend:** Next.js 14 + TypeScript + Tailwind + Framer Motion + Zustand + Socket.io
- **Backend:** FastAPI + SQLAlchemy async + Pydantic v2 + python-socketio + Celery
- **Data:** Postgres 16 + pgvector + Redis + Cloudflare R2
- **AI:** LiteLLM router → Anthropic (Opus 4.7, Sonnet 4.6, Haiku 4.5) + Gemini 3.1 Pro + Kimi
- **Embeddings:** Voyage AI `voyage-3` (1024-dim)
- **Memory:** Mem0 with custom Postgres adapter on `memories` table
- **Document parsing:** unstructured.io
- **Image pipeline:** Remove.bg → Stability AI (FAL.ai fallback)
- **Hosting:** Vercel (web) + Fly.io (api/worker/beat) + Neon (Postgres) + Upstash (Redis)
