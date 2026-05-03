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
  const redirectUri = getRedirectUri();
  const uriSource = process.env.REDIRECT_URI ? "REDIRECT_URI env var (pinned)" : "auto-detected";
  console.log(`[oauth] redirect_uri = ${redirectUri} [${uriSource}]`);

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
  console.log("[process] received SIGTERM — shutting down");
  clearInterval(_keepAlive);
  process.exit(0);
});
