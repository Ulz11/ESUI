# Fly.io deployment notes

The API (FastAPI + Socket.io + APScheduler) runs as a single Fly app. Run
the migration as a release command on every deploy.

## One-time setup

```bash
# 1. Sign in
flyctl auth login

# 2. Launch (creates fly.toml in apps/api — keep your existing one)
cd apps/api
flyctl launch --no-deploy --copy-config

# 3. Push secrets (edit a copy first — never commit real keys)
cp ../../infra/fly/secrets.example.sh ../../infra/fly/secrets.sh
$EDITOR ../../infra/fly/secrets.sh
bash ../../infra/fly/secrets.sh

# 4. Deploy
flyctl deploy
```

`apps/api/fly.toml` already wires:
- `release_command = uv run alembic upgrade head` — runs migrations on every deploy
- `[[http_service.checks]]` against `/healthz` every 30 s
- `auto_stop_machines = "off"` and `min_machines_running = 1` — needed for Socket.io long-lived connections
- shared-cpu-1x / 1 GB — enough for single-tenant load

## Scaling caution

The hourly Signals curator and the nightly memory consolidation run via
APScheduler **inside the API process**. If you ever set
`min_machines_running` above 1 (or autoscale to multiple machines), the
jobs will fire on every machine — duplicate Anthropic spend and duplicate
inserts. Either:

1. Keep it on a single machine (current setting — fine for single-tenant), or
2. Pull the scheduler out into a separate `flyctl deploy --app esui-jobs`
   target with its own Dockerfile and `process = "scheduler"`.

## Rolling secrets

```bash
flyctl secrets set ANTHROPIC_API_KEY=sk-ant-...
flyctl secrets unset OLD_KEY
```

A secret change triggers a rolling restart automatically.
