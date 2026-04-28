# ESUI

Private AI workspace for two users (Esui and Badrushk). Five widgets share one memory layer: Chat, Exam, Vault, Together Photos, Signals.

## Quick start

```bash
# 1) start postgres + redis
pnpm db:up

# 2) install
pnpm install
cd apps/api && uv sync && cd ../..

# 3) configure
cp .env.example apps/api/.env
# edit apps/api/.env with real keys

# 4) migrate
pnpm db:migrate

# 5) run
pnpm dev
```

Web: http://localhost:3000 · API: http://localhost:8000 · Docs: http://localhost:8000/docs

## Docs

Architecture and design specs live in [`docs/`](./docs/README.md). The 3-week MVP omits a few of the v2 ambitions (LiteLLM multi-provider, Mem0 fact extraction, branching, concept maps, knowledge graphs, FAL fallback). Direct Anthropic SDK + simple vector retrieval + APScheduler instead of Celery.

## Layout

```
apps/
  web/   # Next.js 14 (UI is replaced by Claude-Design)
  api/   # FastAPI + Socket.io + SQLAlchemy + APScheduler
docs/    # full architecture & system design
```
