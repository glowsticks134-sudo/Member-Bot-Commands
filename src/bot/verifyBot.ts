import { Client, GatewayIntentBits } from "discord.js";
import { BOT2_TOKEN } from "../config.js";

let _client: Client | null = null;

export function getVerifyClient(): Client | null {
  return _client;
}

export async function startVerifyBot(): Promise<void> {
  if (!BOT2_TOKEN) {
    console.log("[bot2] DISCORD_TOKEN_2 not set — verification bot will not connect");
    return;
  }
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once("ready", (c) => {
    console.log(`[bot2] verification bot ready as ${c.user.tag}`);
  });
  client.on("error", (e) => console.error("[bot2] error", e));
  await client.login(BOT2_TOKEN);
  _client = client;
}
