#!/bin/bash
# Memberty Bot — startup script for self-hosting / Pterodactyl
# Required env vars: DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET
# Optional:          REDIRECT_URI, PORT (defaults to 3000)
set -e

# Install dependencies if missing
if [ ! -d node_modules ]; then
  echo "==> Installing dependencies with pnpm…"
  corepack enable >/dev/null 2>&1 || true
  pnpm install --frozen-lockfile=false
fi

echo "==> Starting Memberty Bot…"
exec pnpm start
