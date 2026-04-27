# Memberty + Gecko Discord Bot (Python)

## Overview

Single-process Python application that runs:

1. **A Discord bot** (`discord.py`) — the Memberty members bot, fully ported
   from the original TypeScript codebase, plus the **Gecko** opt-in
   announcement features (subscribe / unsubscribe buttons, `/announce`).
2. **A FastAPI web server** — handles the OAuth2 redirect, the dashboard JSON
   API, and serves the prebuilt React dashboard if it exists.

Both run together on `PORT` (default `3000`) inside the same asyncio loop —
see `gecko/__main__.py`.

## Stack

- **Language**: Python 3.11
- **Discord library**: `discord.py >= 2.4`
- **Web framework**: `FastAPI` + `uvicorn[standard]`
- **HTTP**: `aiohttp` (for OAuth2 token refresh / member-add calls)
- **Storage**: flat files in `artifacts/data/` (txt + JSON) + a small SQLite
  DB for Gecko subscribers (`subscribers.sqlite3`)
- **Optional UI**: the original React dashboard at `artifacts/dashboard/` —
  build it once with `pnpm --filter @workspace/dashboard build` and the API
  server will serve it at `/dashboard/`. The JSON API at `/api/dashboard/*`
  works whether or not the UI is built.

## Run

```bash
PORT=3000 .pythonlibs/bin/python -m gecko
```

This is wired to the **Start application** workflow.

## Environment variables

| Variable                | Required | Notes                                              |
| ----------------------- | :------: | -------------------------------------------------- |
| `PORT`                  |   yes    | Web server port                                    |
| `DISCORD_BOT_TOKEN`     |    no\*  | Bot will not start without it                      |
| `DISCORD_CLIENT_ID`     |    no\*  | Required for OAuth links                           |
| `DISCORD_CLIENT_SECRET` |    no\*  | Required for OAuth token exchange                  |
| `MEMBERTY_GUILD_ID`     |    no    | Defaults to `1489676641150963936`                  |
| `REDIRECT_URI`          |    no    | Overrides the auto-resolved OAuth redirect URI     |
| `REPLIT_DOMAINS`        |   auto   | Used to derive `REDIRECT_URI` if not set           |
| `RAILWAY_PUBLIC_DOMAIN` |   auto   | Used to derive `REDIRECT_URI` if not set           |
| `LOG_LEVEL`             |    no    | `info` (default), `debug`, etc.                    |

\* If any Discord var is missing, the FastAPI server still runs — only the
   bot is skipped.

## Files

```
gecko/                              # Python package
  __main__.py                       # Entry: starts uvicorn + bot together
  config.py                         # Env vars, paths, hardcoded constants
  storage.py                        # File-backed storage (JSON + token files)
  tokens.py                         # OAuth refresh / exchange / add-member
  announcements.py                  # SQLite subscriber DB (Gecko)
  server.py                         # FastAPI routes (redirect + dashboard API)
  bot/
    __init__.py                     # Re-exports the bot client
    client.py                       # discord.Client, slash + prefix commands
    embeds.py                       # All embed builders
    auth.py                         # Owner / role-based authorization
    restock.py                      # Restock + mass-join + cleanup logic
    control_panel.py                # Owner control panel buttons
    announcements_view.py           # Subscribe / Unsubscribe persistent View

artifacts/data/                     # Runtime data (gitignored, sensitive)
  auths.txt                         # Bulk-stock tokens — userId,access,refresh
  stored_tokens.txt                 # Per-user OAuth-authorized tokens
  role_limits.json                  # Per-guild role -> djoin limit
  channel_locks.json                # Per-guild djoin / auth channel locks
  owner_roles.json                  # Per-guild role -> owner-access
  scheduled_restocks.json           # Pending one-shot restocks
  daily_restock.json                # Recurring daily restock config
  subscribers.sqlite3               # Gecko opt-in subscriber DB
```

## Slash commands

All commands are restricted to the main guild (`MEMBERTY_GUILD_ID`).
Both `/slash` and `!prefix` variants exist for the most common ones.

**Auth** — `/get_token`, `/auth code:`, `/check_tokens`
**Stock** — `/restock`, `/add_token`, `/clear_stock`, `/count`, `/list_users`,
            `/stock`, `/status`
**Mass-join** — `/djoin server_id:`, `/cleanup_servers`
**Servers** — `/servers`, `/server_age`
**Owner** — `/owners`, `/setowner_role`, `/removeowner_role`,
            `/listowner_roles`, `/control_panel`, `/restart`, `/dashboard`
**Role limits** — `/setrole`, `/removerole`, `/listroles`
**Channel locks** — `/setchannel`, `/clearchannel`, `/listchannels`
**Schedules** — `/schedule_restock`, `/list_schedules`, `/cancel_schedule`,
                `/set_daily_restock`, `/cancel_daily_restock`,
                `/daily_restock_status`
**Live embeds** — `/live_stock`, `/live_status`
**Gecko announcements** — `/setup_subscribe`, `/announce`, `/subscribers`
**Utility** — `/help`, `/invite`, `/add`

## Background loops

- **Auto-leave** (every 1h) — leaves any non-main guild older than 14 days.
- **Daily restock** (every 1m) — runs the configured daily restock at MST time.
- **Scheduled restock** (every 1m) — runs due one-shot schedules.
- **Live embeds** (every 30s) — refreshes posted live `/live_stock` and
  `/live_status` embeds.

## OAuth flow

1. User runs `/get_token` → receives an authorization link.
2. They authorize the app; Discord redirects to `/redirect?code=…&state=USER_ID`.
3. `gecko/server.py` exchanges the code, saves tokens to `stored_tokens.txt`,
   and DMs the user a confirmation embed via the bot.

   The Replit workspace router proxies `/redirect` and `/api/` from the public
   domain through the dashboard artifact's Vite dev server (see
   `artifacts/dashboard/vite.config.ts`) into the Python service on port 3000.
   The current public redirect URL is
   `https://${REPLIT_DOMAINS}/redirect` and must be added to the Discord
   Developer Portal's OAuth2 redirect allow-list.

4. `/djoin` mass-joins from the merged set of `auths.txt` + `stored_tokens.txt`.

## Dashboard API

Authentication: `POST /api/dashboard/login {botToken: "..."}` returns an HMAC-
signed bearer token (8-hour TTL). Send it as `Authorization: Bearer <token>`.

Routes: `/api/dashboard/{me,stats,users,guilds,role-limits,owner-roles,channel-locks,restock}`.

Health: `GET /api/healthz` and `GET /healthz`.

## Hardcoded constants

Edit `gecko/config.py` to change:

- `HARDCODED_OWNERS` — global owner Discord IDs (full access in any guild)
- `MAIN_GUILD_ID` default — main Memberty server ID
- `MAX_ROLES_PER_GUILD = 10` — max role-limit entries per guild
