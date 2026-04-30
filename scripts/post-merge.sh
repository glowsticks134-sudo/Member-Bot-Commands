#!/bin/bash
# Runs after a Replit task agent merges work back into main.
# Re-installs Node deps so the workflow comes back up cleanly.
set -e

if [ -f package.json ] && [ -f pnpm-lock.yaml ]; then
  corepack enable >/dev/null 2>&1 || true
  pnpm install --frozen-lockfile=false
fi
