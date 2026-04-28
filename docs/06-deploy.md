# ESUI — Project Layout, Environment, Deployment

---

## 1. Repo layout

Single monorepo. Frontend and backend live side-by-side. pnpm workspaces for JS, `uv` for Python.

```
esui/
├─ apps/
│  ├─ web/                       # Next.js 14 (App Router)
│  │  ├─ app/
│  │  │  ├─ (auth)/
│  │  │  │  ├─ login/
│  │  │  │  └─ verify/
│  │  │  ├─ (workspace)/         # five widget routes + shell
│  │  │  │  ├─ chat/
│  │  │  │  │  └─ [conversation]/
│  │  │  │  ├─ exam/
│  │  │  │  │  └─ [workspace]/
│  │  │  │  ├─ vault/
│  │  │  │  │  └─ [document]/
│  │  │  │  ├─ together/
│  │  │  │  ├─ signals/
│  │  │  │  └─ settings/
│  │  │  ├─ layout.tsx
│  │  │  └─ page.tsx
│  │  ├─ components/
│  │  │  ├─ chat/
│  │  │  ├─ exam/
│  │  │  ├─ vault/
│  │  │  ├─ together/
│  │  │  ├─ signals/
│  │  │  └─ shell/
│  │  ├─ lib/
│  │  │  ├─ api.ts               # typed REST client
│  │  │  ├─ socket.ts            # Socket.io client wrapper
│  │  │  └─ auth.ts
│  │  ├─ hooks/
│  │  ├─ stores/                 # Zustand stores
│  │  └─ public/
│  └─ api/                       # FastAPI
│     ├─ app/
│     │  ├─ widgets/
│     │  │  ├─ chat.py
│     │  │  ├─ vault.py
│     │  │  ├─ exam.py
│     │  │  ├─ together.py
│     │  │  └─ signals.py
│     │  ├─ orchestrator/
│     │  │  ├─ modes.py
│     │  │  ├─ router.py
│     │  │  ├─ retrieval.py
│     │  │  ├─ streaming.py
│     │  │  ├─ tools.py
│     │  │  └─ templates/        # prompt templates per task
│     │  │     ├─ chat/
│     │  │     ├─ exam/
│     │  │     ├─ vault/
│     │  │     └─ signals/
│     │  ├─ memory/
│     │  │  ├─ engine.py
│     │  │  ├─ consolidate.py
│     │  │  └─ adapter.py        # Mem0 → Postgres adapter
│     │  ├─ ingest/
│     │  │  ├─ parse.py
│     │  │  ├─ chunk.py
│     │  │  └─ embed.py
│     │  ├─ realtime/
│     │  │  ├─ server.py
│     │  │  ├─ rooms.py
│     │  │  └─ presence.py
│     │  ├─ integrations/
│     │  │  ├─ anthropic.py
│     │  │  ├─ gemini.py
│     │  │  ├─ moonshot.py
│     │  │  ├─ voyage.py
│     │  │  ├─ removebg.py
│     │  │  ├─ stability.py
│     │  │  ├─ fal.py
│     │  │  ├─ resend.py
│     │  │  └─ unstructured.py
│     │  ├─ jobs/
│     │  │  ├─ ingest.py
│     │  │  ├─ composite.py
│     │  │  ├─ signals.py
│     │  │  ├─ memory.py
│     │  │  ├─ together.py
│     │  │  └─ cleanup.py
│     │  ├─ core/
│     │  │  ├─ db.py
│     │  │  ├─ auth.py
│     │  │  ├─ config.py
│     │  │  ├─ log.py
│     │  │  ├─ errors.py
│     │  │  └─ schemas.py        # shared Pydantic models
│     │  └─ main.py
│     ├─ migrations/             # alembic
│     │  └─ versions/
│     ├─ tests/
│     │  ├─ unit/
│     │  └─ integration/
│     ├─ pyproject.toml
│     ├─ uv.lock
│     ├─ alembic.ini
│     └─ Dockerfile
├─ packages/
│  └─ shared/                    # generated TS types from FastAPI OpenAPI
│     ├─ src/
│     │  └─ api.ts               # codegen output
│     └─ package.json
├─ docs/                         # this folder
│  ├─ README.md
│  ├─ 00-overview.md
│  ├─ 01-data.md
│  ├─ 02-api.md
│  ├─ 03-ai.md
│  ├─ 04-widgets.md
│  ├─ 05-jobs.md
│  └─ 06-deploy.md
├─ infra/
│  ├─ fly/
│  │  ├─ api.fly.toml
│  │  ├─ worker-realtime.fly.toml
│  │  ├─ worker-background.fly.toml
│  │  └─ beat.fly.toml
│  └─ vercel/
│     └─ vercel.json
├─ scripts/
│  ├─ dev.sh                     # runs everything in tmux/concurrently
│  ├─ db.sh                      # migrate / reset / seed
│  └─ codegen-types.sh           # OpenAPI → TS types
├─ docker-compose.yml            # local: postgres + redis
├─ pnpm-workspace.yaml
├─ package.json
├─ .env.example
├─ .gitignore
└─ README.md
```

---

## 2. Environment variables

### `apps/api/.env`

```bash
# core
APP_ENV=development             # development | staging | production
SECRET_KEY=                     # 32 bytes b64 (JWT signing)
ALLOWED_ORIGINS=https://esui.app,http://localhost:3000

# users (allowlist — only these emails get magic links)
ESUI_EMAIL=
BADRUSHK_EMAIL=ulziibadrakhtseren@gmail.com

# postgres
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/esui

# redis
REDIS_URL=redis://default:pass@host:6379/0
CELERY_BROKER_URL=redis://default:pass@host:6379/1
CELERY_RESULT_BACKEND=redis://default:pass@host:6379/2

# r2 / s3
R2_ENDPOINT_URL=https://<account>.r2.cloudflarestorage.com
R2_BUCKET=esui-files
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_PUBLIC_BASE_URL=             # only if using a public CDN; we sign URLs by default

# anthropic
ANTHROPIC_API_KEY=

# google (Gemini 3.1 Pro)
GOOGLE_API_KEY=

# moonshot kimi
MOONSHOT_API_KEY=

# voyage embeddings
VOYAGE_API_KEY=

# image apis
REMOVE_BG_API_KEY=
STABILITY_API_KEY=
FAL_API_KEY=

# email (magic links)
RESEND_API_KEY=
RESEND_FROM=auth@esui.app

# unstructured.io
UNSTRUCTURED_API_KEY=
UNSTRUCTURED_API_URL=https://api.unstructured.io
UNSTRUCTURED_CONCURRENCY=2

# observability (optional)
SENTRY_DSN=

# cost guard
DAILY_COST_CAP_USD=20
```

### `apps/web/.env.local`

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_APP_NAME=ESUI
```

### Production secrets

- Vercel env vars for `apps/web` (production + preview).
- Fly.io secrets for `apps/api`, workers, beat (`fly secrets set ...`).
- Never committed; `.env.example` lists keys with empty values.

---

## 3. Local development

```bash
# bootstrap
pnpm install
uv sync --project apps/api

# start postgres + redis
docker compose up -d db redis

# apply migrations
pnpm db:migrate

# run everything
pnpm dev
```

`pnpm dev` runs concurrently (via `concurrently`):
- `apps/web` — `next dev` on :3000
- `apps/api` — `uvicorn app.main:app --reload` on :8000
- celery worker (realtime queue): `celery -A app.jobs worker -Q realtime -c 4`
- celery worker (background queue): `celery -A app.jobs worker -Q background -c 2`
- celery beat: `celery -A app.jobs beat`

Hot reload everywhere. `db:migrate`, `db:reset`, `db:seed` scripts wrap alembic + a seed script that creates the two `users` rows and a sample conversation.

---

## 4. Hosting

| Component        | Where                               | Notes                                                       |
|------------------|-------------------------------------|-------------------------------------------------------------|
| Web (Next.js)    | Vercel                              | one-click; previews per branch                              |
| API (FastAPI)    | Fly.io (single region: `ord`)       | 1 machine, 1GB, autoscale 1→2                               |
| Worker realtime  | Fly.io (separate process)           | 2 machines, 1GB each                                        |
| Worker background| Fly.io                              | 1 machine, 512MB                                             |
| Celery beat      | Fly.io                              | 1 machine, shared-cpu-1x (smallest)                         |
| Postgres         | Neon (with pgvector enabled)        | autoscaling compute, branched envs for staging              |
| Redis            | Upstash                             | global, low-latency, separate DBs for app/broker/results    |
| Object storage   | Cloudflare R2                       | one bucket; lifecycle rule deletes incomplete uploads after 24h |
| Email            | Resend                              | for magic links, export downloads                            |

Web and API talk over HTTPS. WebSocket upgrades go Vercel → API directly (not via Vercel edge proxies — avoid Vercel WS limits). Configure CORS + WS allowlist on FastAPI for `*.vercel.app` previews + production domain.

### Region

Single region (`ord` — Chicago) for v1. Both users are non-US-time-zone but ord gives best p50 to Mongolia / Asia inbound on Fly's network. Move closer to user if latency becomes an issue (Postgres + Redis are global enough).

---

## 5. Deployment flow

### Web (Vercel)
- GitHub integration. PR → preview deploy. `main` → production.
- Build command: `pnpm --filter web build`
- Install command: `pnpm install --frozen-lockfile`
- `NEXT_PUBLIC_*` env vars set per environment.

### API + workers + beat (Fly.io)
Four `fly.toml`s in `infra/fly/`. Each is a separate Fly app:
- `esui-api`
- `esui-worker-realtime`
- `esui-worker-background`
- `esui-beat`

A single GitHub Action on `main` deploys all four sequentially:
1. Run alembic migrations against production DB (idempotent, fail-fast).
2. `fly deploy --app esui-api --remote-only`
3. `fly deploy --app esui-worker-realtime --remote-only`
4. `fly deploy --app esui-worker-background --remote-only`
5. `fly deploy --app esui-beat --remote-only`

Deploys are zero-downtime via Fly's rolling strategy. Migrations run before code so a successful migration + failed deploy is recoverable (older code can read the new schema for additive changes).

---

## 6. CI/CD

GitHub Actions:

| Workflow            | Triggers                       | Steps                                                          |
|---------------------|--------------------------------|----------------------------------------------------------------|
| `ci`                | PR opened/updated              | install, lint (eslint + ruff + mypy), typecheck (tsc), test (vitest + pytest) |
| `preview`           | PR opened/updated              | Vercel preview (auto via integration); Fly preview app per PR   |
| `deploy`            | push to `main`                 | migrations, deploy api/workers/beat to Fly; Vercel auto-deploys web |
| `nightly`           | cron `0 6 * * *`               | run integration tests against staging                          |

Branch protection on `main`: requires `ci` green + 1 review (the team is two people; the second review is self-imposed quality gate, can be bypassed for tiny fixes).

---

## 7. Security checklist

- [ ] Email allowlist enforced server-side: only `ESUI_EMAIL` and `BADRUSHK_EMAIL` may receive magic links. Other emails return 204 silently.
- [ ] All R2 access via signed URLs, never public.
- [ ] JWT signing with rotated key (HS256, key in env, rotated annually; old key kept in `SECRET_KEY_PREVIOUS` for one rotation cycle).
- [ ] Rate limit `/auth/magic-link` to 5/hour per email.
- [ ] Rate limit `message:send` to 60/min per user.
- [ ] Strict CSP on Next.js (`script-src 'self' 'nonce-...'; connect-src 'self' wss://api.esui.app https://api.esui.app`).
- [ ] All secrets in Fly.io secrets and Vercel env, never in repo.
- [ ] DB connection over SSL (`sslmode=require`).
- [ ] HTTPS-only cookies, `SameSite=Lax` for session.
- [ ] All AI calls log token counts; daily cost cap with warning at $20/user.
- [ ] Audit log: any time admin endpoints (export, delete) are hit, log to `ai_calls` (or a dedicated `audit_log` table if added later).
- [ ] No third-party analytics. No Sentry breadcrumbs containing message content.
- [ ] Anthropic / Voyage API keys are scoped to single project on provider side.

---

## 8. Backup

- **Postgres:** Neon point-in-time recovery (7-day window, included in plan).
- **R2:** cross-region replication to a second R2 bucket (`esui-files-backup`) on a weekly Celery task.
- **DB export:** weekly `pg_dump --no-owner --format=custom` to `r2://esui-backups/db/{YYYY-MM-DD}.dump` via a Celery cleanup task; 90-day retention.
- **Local restore drill:** quarterly. Document the restore procedure in `docs/RESTORE.md` (added when first drill is done).

---

## 9. Migration to production checklist

- [ ] DNS pointed to Vercel (`esui.app`) and Fly.io api host (`api.esui.app`).
- [ ] All env vars set in production (Vercel + 4× Fly apps).
- [ ] Magic-link sender (Resend) verified domain `esui.app`.
- [ ] R2 lifecycle + replication rules configured.
- [ ] Sentry (or alternative) error reporting wired.
- [ ] First migration applied (`alembic upgrade head`).
- [ ] Two `users` rows seeded (Esui + Badrushk) with correct emails.
- [ ] Smoke test: magic link login → chat round trip → vault create → exam generate (small input) → together prompt → signals fetch.
- [ ] Both users invited; both can sign in.
- [ ] Together: Badrushk uploads ≥ 5 photos and marks them eligible.
- [ ] Cost cap configured.
- [ ] Backups scheduled.

---

## 10. Operational runbook (compact)

**Outage: API is down.**
- Check Fly.io status page for `esui-api`. Check `fly logs --app esui-api`.
- Most common cause: DB connection saturation. Increase pool size via env (`DB_POOL_SIZE`) and redeploy.

**Outage: chat streams aren't appearing.**
- Check Socket.io connectivity from web (browser devtools → WS frame).
- Check Anthropic status. If primary is down, fallback should kick in via LiteLLM; verify in `ai_calls`.

**Outage: Together composite stuck.**
- Check Remove.bg / Stability status. Fallback to FAL is automatic; confirm via `together_photos.status`.

**Cost spike.**
- `SELECT task, SUM(cost_cents) FROM ai_calls WHERE created_at > now() - interval '1 day' GROUP BY task ORDER BY 2 DESC;`
- Investigate top tasks. Daily cap should already have downgraded the user; verify.

**Schema rollback needed.**
- Don't. Migrations are additive. Bad data: write a forward migration that fixes it.

**Two users locked out simultaneously.**
- Connect via Fly's `flyctl ssh` to api machine, manually issue tokens via a CLI script (`uv run python -m app.cli issue-token --email ...`). Rotate `SECRET_KEY` after.
