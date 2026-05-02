# ESUI

Private, single-tenant AI workspace built for Esui. Badrushk has read-only
access to the Beauty gallery only — every other route is gated to her.

Seven routes share one memory layer: **Home · Chat · Calendar · Vault ·
Beauty · Signals · Exam**. Two engineered modes (**Ulzii** = TOK / Teacher /
Growth, **Obama** = Tech / Business / Founder) shape the chat and the
schedule planner. Three providers locked: Claude (Opus 4.7 / Sonnet 4.6 /
Haiku 4.5), Gemini 3.1 Pro, Perplexity Sonar.

## Quick start

```bash
# 1) start postgres + redis (or use a local Postgres + Memurai instead)
pnpm db:up

# 2) install
pnpm install
cd apps/api && uv sync && cd ../..

# 3) configure
cp .env.example apps/api/.env
# edit apps/api/.env — at minimum: ESUI_EMAIL, BADRUSHK_EMAIL,
# SECRET_KEY (≥32 chars), ANTHROPIC_API_KEY.

cp apps/web/.env.local.example apps/web/.env.local

# 4) migrate + seed the two users
pnpm db:migrate
pnpm db:seed

# 5) run web + api together
pnpm dev
```

Web: http://localhost:3000 · API: http://localhost:8000 · Docs: http://localhost:8000/docs

In dev (no `RESEND_API_KEY` set) the magic-link sign-in URL prints to the
API logs — copy and paste it into the browser.

## Docs

The single source of truth for the V3 product spec is
[`docs/DESIGN_BRIEF_V3.md`](./docs/DESIGN_BRIEF_V3.md). Everything else
under `docs/` is V1/V2 history kept for reference; do not treat it as
current truth.

## Layout

```
apps/
  web/   # Next.js 14 (App Router) + TypeScript + Tailwind + Framer Motion + Zustand
  api/   # FastAPI + Socket.io + SQLAlchemy async + APScheduler
docs/    # DESIGN_BRIEF_V3.md is current; 00-05.md are archived V1/V2
```

## Stack

- **Frontend:** Next.js 14 (App Router), TypeScript strict, Tailwind, Framer Motion, Zustand, socket.io-client.
- **Backend:** FastAPI, SQLAlchemy 2 async, python-socketio, APScheduler (in-process), Alembic.
- **Storage:** PostgreSQL 16 + pgvector (HNSW), Redis, Cloudflare R2.
- **AI:** direct Anthropic SDK (prompt caching + extended thinking + forced tool-use JSON), Gemini 3.1 Pro HTTP/SSE, Perplexity Sonar Reasoning Pro / Deep Research, Voyage `voyage-3` embeddings (1024-dim).
- **Email (magic-link sign-in):** Resend; in dev the link prints to logs.
