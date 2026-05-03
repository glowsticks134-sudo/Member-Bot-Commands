import "dotenv/config";
import { startServer } from "./server.js";
import { startBot } from "./bot/client.js";
import { BOT_TOKEN, CLIENT_ID, CLIENT_SECRET, getRedirectUri } from "./config.js";
import { botStatus } from "./botStatus.js";

const _keepAlive = setInterval(() => {}, 1 << 30);

async function main(): Promise<void> {
  botStatus.tokenConfigured = Boolean(BOT_TOKEN);
  botStatus.clientIdConfigured = Boolean(CLIENT_ID);
  botStatus.clientSecretConfigured = Boolean(CLIENT_SECRET);

  console.log(`[env] DISCORD_BOT_TOKEN: ${BOT_TOKEN ? "✓ set" : "✗ MISSING"}`);
  console.log(`[env] DISCORD_CLIENT_ID: ${CLIENT_ID ? "✓ set" : "✗ MISSING"}`);
  console.log(`[env] DISCORD_CLIENT_SECRET: ${CLIENT_SECRET ? "✓ set" : "✗ MISSING"}`);
  console.log(`[env] OWNER_PASSWORD: ${process.env.OWNER_PASSWORD ? "✓ set" : "✗ MISSING — owner password commands will not work"}`);
  console.log(`[env] SUPER_OWNER_PASSWORD: ${process.env.SUPER_OWNER_PASSWORD ? "✓ set" : "✗ MISSING — super-owner password commands will not work"}`);
  const redirectUri = getRedirectUri();
  const uriSource = process.env.REDIRECT_URI ? "REDIRECT_URI env var (pinned)" : "auto-detected";
  console.log(`[oauth] redirect_uri = ${redirectUri} [${uriSource}]`);
  if (
    process.env.RAILWAY_PUBLIC_DOMAIN &&
    process.env.REDIRECT_URI &&
    (process.env.REDIRECT_URI.includes("replit.dev") || process.env.REDIRECT_URI.includes("repl.co"))
  ) {
    console.warn("[oauth] ⚠️  WARNING: Running on Railway but REDIRECT_URI points to a Replit domain.");
    console.warn("[oauth] ⚠️  DELETE REDIRECT_URI from Railway variables so the bot uses its own Railway URL.");
  }

  startServer();
  await startBot();
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});

process.on("unhandledRejection", (e) => {
  console.error("[unhandledRejection]", e);
  process.exit(1);
});

process.on("uncaughtException", (e) => {
  console.error("[uncaughtException]", e);
  process.exit(1);
});

process.on("SIGTERM", () => {
  console.log("[process] received SIGTERM — restarting");
  clearInterval(_keepAlive);
  process.exit(1);
});
