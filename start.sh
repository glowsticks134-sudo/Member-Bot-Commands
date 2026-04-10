#!/bin/bash
# Memberty Bot — startup script for self-hosting / Pterodactyl
# Docker image: ghcr.io/pterodactyl/yolks:nodejs_20
# Required env vars: DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, REDIRECT_URI, PORT

node artifacts/api-server/dist/index.mjs
