# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.
Contains an Express API server that also runs a Discord Members Bot.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Discord bot**: discord.js v14 (runs inside api-server)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server + Discord bot locally

## Discord Members Bot

The bot runs inside `artifacts/api-server` alongside the Express server. It starts automatically when the API server starts.

### Features
- All slash commands (no prefix commands)
- Member token backup via OAuth2 flow
- Mass server joining using stored tokens
- Token refresh (auto-refresh expired tokens)
- Auto-leaves servers after 14 days
- Token storage in `artifacts/api-server/data/auths.txt`

### Slash Commands
| Command | Description |
|---|---|
| `/help` | Show all commands |
| `/get_token` | Get OAuth2 authentication link |
| `/auth code:CODE` | Save your OAuth2 code/token |
| `/count` | Show number of stored tokens |
| `/check_tokens` | Validate and refresh all stored tokens |
| `/list_users` | List all authenticated user IDs |
| `/djoin server_id:ID` | Add all users to a target server |
| `/servers` | List servers the bot is in |
| `/server_age` | Check how long bot has been in server(s) |
| `/invite` | Get bot invite link |
| `/setrole role_id:ID limit:N` | Set mass-join limit for a role |
| `/removerole role_id:ID` | Remove a role limit |
| `/listroles` | List all role limits for this server |
| `/setchannel type:djoin\|auth channel_id:ID` | Lock a command to a channel |
| `/clearchannel type:djoin\|auth` | Remove a channel lock |
| `/listchannels` | List all channel locks |

### Data Files
Stored in `artifacts/data/` (gitignored — never committed, created at runtime):
- `auths.txt` — userId,accessToken,refreshToken (one per line, **sensitive**)
- `role_limits.json` — per-guild role limits (max 10 per guild)
- `channel_locks.json` — per-guild channel restrictions for djoin/auth
- `extra_owners.json` — per-guild extra owner user IDs
- `scheduled_restocks.json` — pending scheduled restocks
- `daily_restock.json` — daily restock config

> When self-hosting, make sure `artifacts/data/` is on a persistent volume so data survives restarts.

## Owner Dashboard

A React + Vite web app at `/dashboard/` (port 23183).

### Features
- **Login**: Authenticate with the bot token (HMAC-signed session, 8h TTL)
- **Overview**: Bot status, token count, server count, server list
- **Users**: View/delete stored tokens, validate all tokens, restock from CSV
- **Mass Join**: Start/monitor mass-join jobs with live progress polling
- **Servers**: Browse all servers the bot is in (copy ID)
- **Role Limits**: Per-server per-role join limits (max 10 per server)
- **Channel Settings**: Lock djoin/auth commands to specific channels per server
- **Owners**: Manage extra owners per server

### Dashboard API Routes
All under `/api/dashboard/*`:
- `POST /auth/login` — exchange bot token for session token
- `POST /auth/verify` — validate session token
- `GET /stats` — bot stats and server list
- `GET /users`, `DELETE /users/:id` — user token management
- `POST /check-tokens`, `POST /restock` — token operations
- `POST /djoin`, `GET /djoin/:jobId` — mass join jobs
- `GET /servers` — server list
- `GET/POST/DELETE /role-limits/*` — role limit CRUD
- `GET/POST/DELETE /channels/*` — channel lock CRUD
- `GET/POST/DELETE /owners/*` — extra owner management

### Required Environment Variables
- `DISCORD_BOT_TOKEN` — Bot token from Discord Developer Portal
- `DISCORD_CLIENT_ID` — Application Client ID
- `DISCORD_CLIENT_SECRET` — Application Client Secret
- `PORT` — Port the server listens on (default: `8080`)
- `REDIRECT_URI` — Full public URL of the OAuth2 redirect endpoint (e.g. `https://yourdomain.com/redirect`). On Replit this is auto-derived from `REPLIT_DOMAINS`. Self-hosters must set this explicitly and register it in the Discord Developer Portal under OAuth2 → Redirects.

See `.env.example` for a full reference.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
