import { Client, GatewayIntentBits } from "discord.js";
import { BOT3_TOKEN } from "../config.js";

export async function startJoinerBot(): Promise<void> {
  if (!BOT3_TOKEN) {
    console.log("[bot3] TOKEN_3 not set — joiner bot will not connect (falls back to Bot 1 for guild adds)");
    return;
  }
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once("ready", (c) => {
    console.log(`[bot3] joiner bot ready as ${c.user.tag}`);
  });
  client.on("error", (e) => console.error("[bot3] error", e));
  await client.login(BOT3_TOKEN);
}
