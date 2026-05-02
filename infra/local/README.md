# Local development without Docker

Two services need to be reachable on `localhost` before `pnpm dev` works:
**PostgreSQL 16+** with the `pgvector` extension, and **Redis 7+**. Both run
fine natively on Windows / macOS / Linux without Docker.

---

## 1) PostgreSQL — native

If you already have PostgreSQL installed (we confirmed `postgresql-x64-18`
on your machine listening on **port 5433**), you only need to create an
`esui` database, an `esui` role, and enable `pgvector` in it.

### One-time setup

Run **`infra/local/setup-postgres.ps1`** as your normal user (it will
prompt for the `postgres` superuser password once). The script:

1. Creates role `esui` with password `esui` (idempotent — does nothing if
   the role exists).
2. Creates database `esui` owned by `esui` (idempotent).
3. Enables `pgvector` in the `esui` database.

```powershell
# from the repo root
infra\local\setup-postgres.ps1
```

If your Postgres listens on a non-default port (5433 is common when a
prior install grabbed 5432), pass `-Port 5433`:

```powershell
infra\local\setup-postgres.ps1 -Port 5433
```

### Then point the API at it

`apps/api/.env`:

```ini
DATABASE_URL=postgresql+asyncpg://esui:esui@localhost:5433/esui
```

(Drop `:5433` if your Postgres is on the default 5432.)

### How to install Postgres if you don't have it

- **Windows:** download the EnterpriseDB installer from
  <https://www.postgresql.org/download/windows/>. Pick PostgreSQL 16+.
  When asked, set a password for the `postgres` superuser — remember it.
- **macOS:** `brew install postgresql@16` then `brew services start postgresql@16`.
- **Linux (Debian/Ubuntu):** `sudo apt install postgresql-16 postgresql-16-pgvector`.

The `pgvector` extension comes pre-bundled on the Windows installer
(stack builder) and is one apt/brew package away on Linux/macOS.

---

## 2) Redis — native

Pick one. Memurai is the smoothest path on Windows.

### Option A: Memurai (Windows, free Developer edition)

Memurai is a drop-in Redis-compatible server for Windows. It runs as a
Windows service, no Docker, no WSL.

```powershell
# Install (no admin needed if winget is configured)
winget install Memurai.MemuraiDeveloper

# Or download from https://www.memurai.com/get-memurai
```

After install it auto-starts as a service on `localhost:6379`. Verify:

```powershell
& 'C:\Program Files\Memurai\memurai-cli.exe' ping
# → PONG
```

`apps/api/.env` already points at it:

```ini
REDIS_URL=redis://localhost:6379/0
```

### Option B: Upstash (cloud, free tier)

If you'd rather not install anything else, sign up at
<https://upstash.com/> (free tier covers personal-scale usage). Create a
database, copy the **TLS** connection URL, and paste it into
`apps/api/.env`:

```ini
REDIS_URL=rediss://default:PASSWORD@HOST.upstash.io:6379
```

### Option C: WSL — only if you already use WSL

```bash
sudo apt install redis-server
sudo service redis-server start
```

Reaches `localhost:6379` from your Windows side automatically.

---

## 3) Run the app

After Postgres + Redis are up, the rest is the same as before:

```powershell
# install web + api deps
pnpm install
pushd apps\api ; uv sync ; popd

# fill in apps/api/.env (ESUI_EMAIL, BADRUSHK_EMAIL, SECRET_KEY, ANTHROPIC_API_KEY at minimum)
pnpm db:migrate
pnpm db:seed

# starts web (3000) and api (8000) together
pnpm dev
```

In dev (no `RESEND_API_KEY` set), the magic-link sign-in URL prints to
the API logs — copy it from the terminal into your browser.

---

## What about the `pnpm db:up` script?

That one shells out to `docker compose up -d db redis` — it's now an
**opt-in convenience for people who do want Docker**, not the default
path. If you already have Postgres + Redis running natively, you don't
need it.

To stop pretending you have Docker:

```powershell
# never run this:
pnpm db:up      # docker-only

# run these instead:
pnpm db:migrate # alembic against your native Postgres
pnpm db:seed    # seed Esui + Badrushk users
pnpm dev        # web + api
```

---

## Production

Production never touches Docker on your laptop. Fly.io builds the API
container itself from `apps/api/Dockerfile` server-side; you only run
`flyctl deploy`. Vercel builds the web app the same way — no local
Docker step.

See `infra/fly/README.md` for the deploy flow.
