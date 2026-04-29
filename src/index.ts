import "dotenv/config";
import { startServer } from "./server.js";
import { startBot } from "./bot/client.js";

async function main(): Promise<void> {
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
