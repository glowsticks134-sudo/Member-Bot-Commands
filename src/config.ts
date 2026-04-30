import path from "node:path";
import fs from "node:fs";
import "dotenv/config";
import { getSavedRedirect } from "./storage/redirectConfig.js";

export const PORT = Number(process.env.PORT ?? 3000);

export const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN ?? "";
export const CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? "";
export const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET ?? "";

export const MAIN_GUILD_ID =
  process.env.MEMBERTY_GUILD_ID ?? "1489676641150963936";

export const HARDCODED_OWNERS = [
  "1411750730380869828",
  "1486174745333465179",
];

// Single super-owner who can run private bot-wide commands
// (blacklist, enable_server, etc). Override with env var SUPER_OWNER_ID.
export const SUPER_OWNER_ID =
  process.env.SUPER_OWNER_ID ?? "1411750730380869828";

export const MAX_ROLES_PER_GUILD = 10;
export const PREFIX = "!";

// Default redirect URL — this Repl's dev URL. It's served without publishing
// the app and is stable for the lifetime of this Repl. If you ever fork or
// recreate the Repl, update this string (or set the REDIRECT_URI env var).
const HARDCODED_REDIRECT =
  "https://53fcb274-a470-4f68-a4fd-8274154e81f8-00-1alipnha52njx.kirk.replit.dev/auth/callback";

export function getPublicDomain(): string | null {
  if (process.env.REDIRECT_URI) {
    try {
      const u = new URL(process.env.REDIRECT_URI);
      return `${u.protocol}//${u.host}`;
    } catch {
      // fallthrough
    }
  }
  // Replit dev domain — works while developing, no publish required.
  const dev = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (dev) return `https://${dev}`;
  const replit = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (replit) return `https://${replit}`;
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railway) return `https://${railway}`;
  return null;
}

export function getRedirectUri(): string {
  const saved = getSavedRedirect();
  if (saved && saved.length > 0) return saved;
  if (process.env.REDIRECT_URI) return process.env.REDIRECT_URI;
  const domain = getPublicDomain();
  if (domain) return `${domain}/auth/callback`;
  return HARDCODED_REDIRECT;
}

// ─── Data paths (preserve Python layout) ──────────────────────────────────────
export const DATA_DIR = path.resolve("artifacts/data");
fs.mkdirSync(DATA_DIR, { recursive: true });

export const AUTHS_FILE = path.join(DATA_DIR, "auths.txt");
export const STORED_TOKENS_FILE = path.join(DATA_DIR, "stored_tokens.txt");
export const ROLE_LIMITS_FILE = path.join(DATA_DIR, "role_limits.json");
export const CHANNEL_LOCKS_FILE = path.join(DATA_DIR, "channel_locks.json");
export const OWNER_ROLES_FILE = path.join(DATA_DIR, "owner_roles.json");
export const SCHEDULED_RESTOCKS_FILE = path.join(
  DATA_DIR,
  "scheduled_restocks.json",
);
export const DAILY_RESTOCK_FILE = path.join(DATA_DIR, "daily_restock.json");
export const SUBSCRIBERS_DB = path.join(DATA_DIR, "subscribers.sqlite3");

export const COLOR = {
  blurple: 0x5865f2,
  green: 0x57f287,
  red: 0xed4245,
  yellow: 0xfaa61a,
} as const;
