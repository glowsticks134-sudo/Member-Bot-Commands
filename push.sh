#!/bin/bash
set -e

echo "==> Pushing to GitHub..."
git config user.email "bot@replit.com"
git config user.name "Memberty Bot"
git remote set-url origin "https://glowsticks134-sudo:${GITHUB_TOKEN}@github.com/glowsticks134-sudo/Member-Bot-Commands.git"
git add -A
git commit -m "Update $(date '+%Y-%m-%d %H:%M')" || echo "Nothing new to commit"
git push origin main

echo ""
echo "Done! Your GitHub is up to date."
echo "Railway will now auto-deploy the update."
