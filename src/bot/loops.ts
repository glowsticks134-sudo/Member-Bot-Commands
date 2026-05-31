import { EmbedBuilder, type Client } from "discord.js";
import { COLOR, MAIN_GUILD_ID } from "../config.js";
import { sendBotLog } from "./logger.js";
import type { BotState } from "./client.js";

const HOUR_MS = 60 * 60 * 1000;

export function startLoops(client: Client, state: BotState): void {
  // Auto-leave guilds older than 14 days (every hour)
  setInterval(() => autoLeaveTick(client, state).catch(console.error), HOUR_MS);
}

async function autoLeaveTick(client: Client, state: BotState): Promise<void> {
  const now = Date.now();
  for (const g of [...client.guilds.cache.values()]) {
    if (g.id === MAIN_GUILD_ID) continue;
    const joined = state.serverJoinTimes.get(g.id);
    if (!joined) continue;
    const days = Math.floor((now - joined.getTime()) / 86_400_000);
    if (days >= 14) {
      console.log(`[auto-leave] leaving ${g.name} after ${days} days`);
      try {
        await g.leave();
        state.serverJoinTimes.delete(g.id);
        await sendBotLog(
          client,
          MAIN_GUILD_ID,
          new EmbedBuilder()
            .setTitle("👋 Auto-Left Server")
            .setColor(COLOR.yellow)
            .addFields(
              { name: "🏠 Server", value: `${g.name} (\`${g.id}\`)`, inline: true },
              { name: "📅 Days in Server", value: String(days), inline: true },
            )
            .setTimestamp(),
        );
      } catch (e) {
        console.error("[auto-leave] failed to leave", g.id, e);
      }
    }
  }
}
