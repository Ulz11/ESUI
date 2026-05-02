#!/usr/bin/env bash
# ── ESUI on Fly.io — secrets bootstrap ──────────────────────────────────────
#
# Copy this file to `secrets.sh`, fill in the real values, then run it once
# from the repo root after `fly launch`:
#
#     bash infra/fly/secrets.example.sh
#
# `secrets.sh` is gitignored. Never commit a populated copy.
#
# All values are read by apps/api/app/core/config.py. Keep this list in sync
# with .env.example at the repo root.

set -euo pipefail

APP="${FLY_APP:-esui-api}"

flyctl secrets set --app "$APP" \
  APP_ENV="production" \
  SECRET_KEY="REPLACE_WITH_AT_LEAST_32_RANDOM_BYTES_BASE64" \
  ALLOWED_ORIGINS='["https://esui.app","https://www.esui.app"]' \
  \
  ESUI_EMAIL="esui@example.com" \
  BADRUSHK_EMAIL="ulziibadrakhtseren@gmail.com" \
  \
  DATABASE_URL="postgresql+asyncpg://USER:PASS@HOST:5432/esui" \
  REDIS_URL="rediss://default:PASS@HOST:6379" \
  \
  R2_ENDPOINT_URL="https://ACCOUNT.r2.cloudflarestorage.com" \
  R2_BUCKET="esui-files" \
  R2_ACCESS_KEY_ID="REPLACE_ME" \
  R2_SECRET_ACCESS_KEY="REPLACE_ME" \
  \
  ANTHROPIC_API_KEY="sk-ant-REPLACE_ME" \
  OPUS_MODEL_ID="claude-opus-4-7" \
  SONNET_MODEL_ID="claude-sonnet-4-6" \
  HAIKU_MODEL_ID="claude-haiku-4-5" \
  \
  GOOGLE_API_KEY="REPLACE_ME" \
  GEMINI_MODEL_ID="gemini-3.1-pro" \
  \
  PERPLEXITY_API_KEY="pplx-REPLACE_ME" \
  PERPLEXITY_RESEARCH_MODEL_ID="sonar-deep-research" \
  PERPLEXITY_REASONING_MODEL_ID="sonar-reasoning-pro" \
  \
  VOYAGE_API_KEY="REPLACE_ME" \
  \
  UNSTRUCTURED_API_KEY="REPLACE_ME" \
  UNSTRUCTURED_API_URL="https://api.unstructured.io" \
  \
  RESEND_API_KEY="re_REPLACE_ME" \
  RESEND_FROM="auth@esui.app" \
  \
  DAILY_COST_CAP_USD="20"

echo
echo "✓ Secrets pushed to $APP."
echo "  Verify with: flyctl secrets list --app $APP"
echo
echo "Next:"
echo "  flyctl deploy --app $APP"
echo "  flyctl logs   --app $APP   # watch the migration release-command + boot"
