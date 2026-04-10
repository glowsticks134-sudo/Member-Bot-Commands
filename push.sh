#!/bin/bash
set -e

echo "==> Building latest bot..."
pnpm --filter @workspace/api-server run build

echo "==> Removing source maps..."
rm -f artifacts/api-server/dist/*.map

echo "==> Pushing to GitHub..."
git config user.email "bot@replit.com"
git config user.name "Memberty Bot"
git remote set-url origin "https://glowsticks134-sudo:${GITHUB_TOKEN}@github.com/glowsticks134-sudo/Member-Bot-Commands.git"
git add -A
git commit -m "Update $(date '+%Y-%m-%d %H:%M')" || echo "Nothing new to commit"
git push origin main

echo ""
echo "Done! Your GitHub is up to date."
echo "Go to HeavenCloud and click Reinstall to apply the update."
