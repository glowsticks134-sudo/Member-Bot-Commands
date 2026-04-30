import "dotenv/config";
import { startServer } from "./server.js";
import { startBot } from "./bot/client.js";
import { getRedirectUri } from "./config.js";

async function main(): Promise<void> {
  console.log(`[oauth] redirect_uri = ${getRedirectUri()}`);
  console.log(
    "[oauth] add this exact URL in Discord Dev Portal → OAuth2 → Redirects",
  );
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
