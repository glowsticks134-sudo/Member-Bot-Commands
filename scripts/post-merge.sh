#!/bin/bash
# Runs after a Replit task agent merges work back into main.
# Re-installs Python deps so the workflow comes back up cleanly.
set -e

if [ -f pyproject.toml ]; then
  if command -v uv >/dev/null 2>&1; then
    uv sync --frozen 2>/dev/null || uv sync
  elif [ -x .pythonlibs/bin/pip ]; then
    .pythonlibs/bin/pip install -e . 2>/dev/null || true
  fi
fi
