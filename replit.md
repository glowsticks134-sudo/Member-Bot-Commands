# Memberty + Gecko Discord Bot (TypeScript)

## Overview

Single-process **TypeScript / Node.js** application that runs:

1. **A Discord bot** (`discord.js` v14) — slash + prefix commands for OAuth-based
   member backup/restore (Memberty), plus the **Gecko** opt-in announcement
   features (subscribe / unsubscribe buttons, `/announce`).
2. **An Express web server** — handles the OAuth2 redirect landing page.

Both run together in a single Node process on `PORT` (default `3000`) — see
`src/index.ts`.

## Stack

- **Language**: TypeScript, run directly via `tsx` (no build step)
- **Discord library**: `discord.js` v14
- **Web framework**: `express` v5
- **Storage**: flat files in `artifacts/data/` (txt + JSON) + a small SQLite DB
  for Gecko subscribers (`subscribers.sqlite3`, via `better-sqlite3`)

## Run

```bash
PORT=3000 npx tsx src/index.ts
# or, equivalently:
pnpm dev
```

This is wired to the **Start application** workflow.

## Environment variables

| Variable                | Required | Notes                                              |
| ----------------------- | :------: | -------------------------------------------------- |
| `PORT`                  |    no    | Web server port (defaults to `3000`)               |
| `DISCORD_BOT_TOKEN`     |   yes\*  | Bot will not connect without it                    |
| `DISCORD_CLIENT_ID`     |   yes\*  | Required for OAuth links and slash command sync    |
| `DISCORD_CLIENT_SECRET` |   yes\*  | Required for OAuth token exchange                  |
| `MEMBERTY_GUILD_ID`     |    no    | Defaults to `1489676641150963936`                  |
| `REDIRECT_URI`          |    no    | Overrides the default OAuth redirect URI           |
| `REPLIT_DOMAINS`        |   auto   | Used to derive the public domain                   |
| `RAILWAY_PUBLIC_DOMAIN` |   auto   | Used to derive the public domain                   |

\* If any Discord var is missing, the Express server still runs — only the bot
   is skipped. You can set these in Replit Secrets.

The OAuth callback path is **`/auth/callback`** (with `/redirect` kept as an
alias for older links). The default redirect URI is hardcoded to
`https://member-bot-commands--manager28311.replit.app/auth/callback` so the
Discord Developer Portal needs no changes after the rewrite.

## Files

```
src/
  index.ts                # Entry: starts express + bot together
  config.ts               # Env vars, paths, hardcoded constants
  oauth.ts                # OAuth code exchange / refresh / addUserToGuild
  server.ts               # Express routes (/, /auth/callback, /redirect, /healthz)
  storage/
    files.ts              # Generic JSON / line-based file helpers
    tokens.ts             # auths.txt + stored_tokens.txt
    roles.ts              # role_limits.json
    locks.ts              # channel_locks.json
    owners.ts             # owner_roles.json
    schedules.ts          # scheduled_restocks.json + daily_restock.json
    subscribers.ts        # subscribers.sqlite3 (Gecko opt-in)
  bot/
    client.ts             # discord.js Client + interaction wiring
    commands.ts           # All slash command definitions + dispatch
    prefix.ts             # `!` prefix command mirror
    embeds.ts             # All embed builders
    permissions.ts        # Owner / role-based authorization
    restock.ts            # Restock + mass-join + cleanup logic
    controlPanel.ts       # Owner control panel buttons (cp:* custom ids)
    subscribeView.ts      # Subscribe / Unsubscribe buttons (gecko:* custom ids)
    loops.ts              # Background timers

artifacts/data/           # Runtime data (gitignored, sensitive)
  auths.txt               # Bulk-stock tokens — userId,access,refresh
  stored_tokens.txt       # Per-user OAuth-authorized tokens
  role_limits.json        # Per-guild role -> djoin limit
  channel_locks.json      # Per-guild djoin / auth channel locks
  owner_roles.json        # Per-guild role -> owner-access
  scheduled_restocks.json # Pending one-shot restocks
  daily_restock.json      # Recurring daily restock config
  subscribers.sqlite3     # Gecko opt-in subscriber DB
```

## Slash commands

All commands are restricted to the main guild (`MEMBERTY_GUILD_ID`).
Both `/slash` and `!prefix` variants exist for the most common ones.

- **Auth** — `/get_token`, `/auth code:`, `/check_tokens`
- **Stock** — `/restock`, `/add_token`, `/clear_stock`, `/count`, `/list_users`,
              `/stock`, `/status`
- **Mass-join** — `/djoin server_id:`, `/cleanup_servers`
- **Servers** — `/servers`, `/server_age`
- **Owner** — `/owners`, `/setowner_role`, `/removeowner_role`,
              `/listowner_roles`, `/control_panel`, `/restart`, `/dashboard`
- **Role limits** — `/setrole`, `/removerole`, `/listroles`
- **Channel locks** — `/setchannel`, `/clearchannel`, `/listchannels`
- **Schedules** — `/schedule_restock`, `/list_schedules`, `/cancel_schedule`,
                  `/set_daily_restock`, `/cancel_daily_restock`,
                  `/daily_restock_status`
- **Live embeds** — `/live_stock`, `/live_status`
- **Gecko announcements** — `/setup_subscribe`, `/announce`, `/subscribers`
- **Utility** — `/help`, `/invite`, `/add`

## Background loops

- **Auto-leave** (every 1h) — leaves any non-main guild older than 14 days.
- **Daily restock** (every 1m) — runs the configured daily restock at MST time.
- **Scheduled restock** (every 1m) — runs due one-shot schedules.
- **Live embeds** (every 30s) — refreshes posted live `/live_stock` and
  `/live_status` embeds.

## OAuth flow

1. User runs `/get_token` → receives an authorization link.
2. They authorize the app; Discord redirects to
   `/auth/callback?code=…&state=USER_ID`.
3. The Express server renders a page showing the code and a `/auth code:CODE`
   command pre-filled, with a one-tap **Copy** button.
4. The user pastes that into Discord and the bot saves their tokens to
   `stored_tokens.txt`.
5. `/djoin` mass-joins from `auths.txt` (the bulk-stock pool).

## Hardcoded constants

Edit `src/config.ts` to change:

- `HARDCODED_OWNERS` — global owner Discord IDs (full access in any guild)
- `MAIN_GUILD_ID` default — main Memberty server ID
- `MAX_ROLES_PER_GUILD = 10` — max role-limit entries per guild
- The default OAuth redirect URI

## Type-checking

```bash
pnpm typecheck:bot   # TypeScript check just for the bot source
pnpm typecheck       # full workspace type-check
```
