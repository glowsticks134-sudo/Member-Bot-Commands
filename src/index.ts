import "dotenv/config";
import { startServer } from "./server.js";
import { startBot } from "./bot/client.js";
import { getRedirectUri } from "./config.js";
import { BOT_TOKEN, CLIENT_ID, CLIENT_SECRET } from "./config.js";
import { botStatus } from "./botStatus.js";

async function main(): Promise<void> {
  // Mark what's configured before bot starts
  botStatus.tokenConfigured = Boolean(BOT_TOKEN);
  botStatus.clientIdConfigured = Boolean(CLIENT_ID);
  botStatus.clientSecretConfigured = Boolean(CLIENT_SECRET);

  console.log(`[oauth] redirect_uri = ${getRedirectUri()}`);
  console.log("[oauth] add this exact URL in Discord Dev Portal → OAuth2 → Redirects");
  console.log(`[env] DISCORD_BOT_TOKEN: ${BOT_TOKEN ? "✓ set" : "✗ MISSING"}`);
  console.log(`[env] DISCORD_CLIENT_ID: ${CLIENT_ID ? "✓ set" : "✗ MISSING"}`);
  console.log(`[env] DISCORD_CLIENT_SECRET: ${CLIENT_SECRET ? "✓ set" : "✗ MISSING"}`);

  startServer();
  await startBot();
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});

process.on("unhandledRejection", (e) => {
  console.error("[unhandledRejection]", e);
});
process.on("uncaughtException", (e) => {
  console.error("[uncaughtException]", e);
});
