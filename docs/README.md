# ESUI — Docs

> **Source of truth: [`DESIGN_BRIEF_V3.md`](./DESIGN_BRIEF_V3.md).**
> Everything else in this folder is V1/V2 history kept for reference.
> If anything in `00-overview.md` … `06-deploy.md` contradicts the V3 brief,
> the V3 brief wins.

## What ESUI actually is (V3)

Single-tenant private workspace for **Esui**. Badrushk has read-only access
to the **Beauty** gallery only — every other route is gated to Esui.

Seven routes share one memory layer: **Home · Chat · Calendar · Vault ·
Beauty · Signals · Exam**.

Two engineered AI modes:
- **Ulzii** — TOK / Teacher / Growth lens. Voronoi-style knowledge maps,
  mind maps, ways-of-knowing prompts.
- **Obama** — Tech / Business / Founder lens. Market research, three-scenario
  sims, decision memos, tech-stack reasoning.

Three providers locked, env-driven model IDs:
- Claude (Opus 4.7 / Sonnet 4.6 / Haiku 4.5)
- Gemini 3.1 Pro
- Perplexity Sonar (Reasoning Pro / Deep Research)

## Stack (current)

- **Frontend:** Next.js 14 (App Router), TypeScript strict, Tailwind, Framer Motion, Zustand, socket.io-client.
- **Backend:** FastAPI, SQLAlchemy 2 async, python-socketio, **APScheduler** (in-process — no Celery), Alembic.
- **Storage:** PostgreSQL 16 + pgvector (HNSW), Redis, Cloudflare R2.
- **AI:** **direct Anthropic / Google / Perplexity SDKs** (no LiteLLM router); prompt caching + extended thinking + forced tool-use JSON; Voyage `voyage-3` embeddings (1024-dim).
- **Memory:** **direct Postgres** (no Mem0). Haiku fact extraction → Sonnet consolidation → salience decay → Redis "do not re-learn" set.
- **Document parsing:** Unstructured (optional; can be off in dev).
- **Beauty:** clean gallery only — no compositing pipeline (no Remove.bg / Stability / FAL).
- **Hosting:** Vercel (web) + Fly.io (api) + Neon (Postgres) + Upstash (Redis) + Cloudflare R2 (files) + Resend (email).

## Archived

The files below describe earlier (V1 / V2) iterations and are retained for
reference. They reference Together Photos, LiteLLM, Mem0, Celery, Kimi,
Remove.bg, Stability, FAL — none of which are in V3.

| #  | Document                            | Status     |
|----|-------------------------------------|------------|
| 00 | [Overview](00-overview.md)          | ARCHIVED — V2 |
| 01 | [Data](01-data.md)                  | ARCHIVED — V2 |
| 02 | [API](02-api.md)                    | ARCHIVED — V2 |
| 03 | [AI Layer](03-ai.md)                | ARCHIVED — V2 |
| 04 | [Widgets](04-widgets.md)            | ARCHIVED — V2 |
| 05 | [Jobs](05-jobs.md)                  | ARCHIVED — V2 (Celery) |
| 06 | [Deploy](06-deploy.md)              | ARCHIVED — V2 (4-app deploy; current is single-app) |
| —  | [DESIGN_BRIEF.md](./DESIGN_BRIEF.md)       | ARCHIVED — V1 |
| —  | [DESIGN_BRIEF_V2.md](./DESIGN_BRIEF_V2.md) | ARCHIVED — V2 |
| —  | [**DESIGN_BRIEF_V3.md**](./DESIGN_BRIEF_V3.md) | **CURRENT** |
