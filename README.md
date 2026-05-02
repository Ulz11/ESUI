# ESUI

Private, single-tenant AI workspace built for Esui. Badrushk has read-only
access to the Beauty gallery only — every other route is gated to her.

Seven routes share one memory layer: **Home · Chat · Calendar · Vault ·
Beauty · Signals · Exam**. Two engineered modes (**Ulzii** = TOK / Teacher /
Growth, **Obama** = Tech / Business / Founder) shape the chat and the
schedule planner. Three providers locked: Claude (Opus 4.7 / Sonnet 4.6 /
Haiku 4.5), Gemini 3.1 Pro, Perplexity Sonar.

## Quick start (no Docker)

```powershell
# 1) Provision the local Postgres (creates esui DB + role, enables pgvector)
infra\local\setup-postgres.ps1            # default port 5432
# infra\local\setup-postgres.ps1 -Port 5433   # if your Postgres is on 5433

# 2) Install Memurai (Redis-compatible, Windows-native)
winget install Memurai.MemuraiDeveloper
# (or use Upstash — see infra/local/README.md for both options)

# 3) Install deps
pnpm install
pushd apps\api ; uv sync ; popd

# 4) Configure
cp .env.example apps/api/.env
#   edit apps/api/.env — at minimum: ESUI_EMAIL, BADRUSHK_EMAIL,
#   SECRET_KEY (≥32 chars), ANTHROPIC_API_KEY.
#   adjust DATABASE_URL port to 5433 if needed.

cp apps/web/.env.local.example apps/web/.env.local

# 5) Migrate + seed
pnpm db:migrate
pnpm db:seed

# 6) Run web + api together
pnpm dev
```

Web: <http://localhost:3000> · API: <http://localhost:8000> · API docs: <http://localhost:8000/docs>

In dev (no `RESEND_API_KEY` set), the magic-link sign-in URL prints to the
API logs — copy it from the terminal into your browser. There is no email
service to set up locally.

Full local-dev guide (macOS / Linux / Windows; Memurai / Upstash / WSL
Redis options): [`infra/local/README.md`](./infra/local/README.md).

## Quick start (Docker — optional)

If you happen to have Docker Desktop running, this is a one-liner instead
of steps 1–2 above:

```bash
pnpm db:up    # docker compose up -d db redis
# then continue from step 3
```

The Docker path is opt-in. The native path above is the default.

## Production

Production never needs Docker on your machine. Fly.io builds the API
image server-side from `apps/api/Dockerfile`; Vercel builds the web app
in their own runner. You only run `flyctl deploy` and push to GitHub.

- API on Fly.io: [`infra/fly/README.md`](./infra/fly/README.md)
- Web on Vercel: `apps/web/vercel.json` + set Root Directory =
  `apps/web` in the Vercel dashboard.

## Docs

The single source of truth for the V3 product spec is
[`docs/DESIGN_BRIEF_V3.md`](./docs/DESIGN_BRIEF_V3.md). Everything else
under `docs/` is V1/V2 history kept for reference; do not treat it as
current truth.

## Layout

```
apps/
  web/         # Next.js 14 (App Router) + TypeScript + Tailwind + Framer Motion + Zustand
  api/         # FastAPI + Socket.io + SQLAlchemy async + APScheduler
docs/          # DESIGN_BRIEF_V3.md is current; 00-05.md are archived V1/V2
infra/
  local/       # No-Docker dev setup: Postgres provision script + guide
  fly/         # Fly.io secrets bootstrap + deploy notes
```

## Stack

- **Frontend:** Next.js 14 (App Router), TypeScript strict, Tailwind, Framer Motion, Zustand, socket.io-client.
- **Backend:** FastAPI, SQLAlchemy 2 async, python-socketio, APScheduler (in-process), Alembic.
- **Storage:** PostgreSQL 16+ with pgvector (HNSW), Redis 7+, Cloudflare R2.
- **AI:** direct Anthropic SDK (prompt caching + extended thinking + forced tool-use JSON), Gemini 3.1 Pro HTTP/SSE, Perplexity Sonar Reasoning Pro / Deep Research, Voyage `voyage-3` embeddings (1024-dim).
- **Email (magic-link sign-in):** Resend; in dev the link prints to logs.
