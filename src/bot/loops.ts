import { EmbedBuilder, type Client, type TextChannel } from "discord.js";
import { COLOR, MAIN_GUILD_ID } from "../config.js";
import { sendBotLog } from "./logger.js";
import {
  readDailyRestock,
  readScheduledRestocks,
  writeDailyRestock,
  writeScheduledRestocks,
} from "../storage/schedules.js";
import { doRestock } from "./restock.js";
import { stockEmbed, statusEmbed } from "./embeds.js";
import { readChannelLocks } from "../storage/locks.js";
import { readAuthUsers } from "../storage/tokens.js";
import { getRestockTemplate, renderRestockTemplate } from "../storage/restockTemplate.js";
import type { BotState } from "./client.js";

const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

export function startLoops(client: Client, state: BotState): void {
  // Auto-leave guilds older than 14 days (every hour)
  setInterval(() => autoLeaveTick(client, state).catch(console.error), HOUR_MS);

  // Daily restock (every minute)
  setInterval(
    () => dailyRestockTick(client).catch(console.error),
    MIN_MS,
  );

  // Scheduled restocks (every minute)
  setInterval(
    () => scheduledRestockTick(client).catch(console.error),
    MIN_MS,
  );

  // Live embeds (every 30s)
  setInterval(() => liveEmbedTick(client, state).catch(console.error), 30_000);
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

async function dailyRestockTick(client: Client): Promise<void> {
  const daily = readDailyRestock();
  if (!daily) return;
  const now = new Date();
  const mstHour = (now.getUTCHours() + 24 - 7) % 24;
  const current = `${String(mstHour).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  const today = now.toISOString().slice(0, 10);
  if (current !== daily.time || daily.lastRanDate === today) return;

  daily.lastRanDate = today;
  writeDailyRestock(daily);
  const restockResult = await doRestock(daily.rawTokens);
  try {
    const ch = (await client.channels.fetch(daily.channelId)) as TextChannel | null;
    if (!ch || !ch.isTextBased()) return;
    const guildId = (ch as TextChannel).guild?.id ?? MAIN_GUILD_ID;
    const locks = readChannelLocks()[guildId] ?? {};
    const farmId = (locks as Record<string, string>).farm ?? null;
    const addBotId = (locks as Record<string, string>).addbot ?? null;
    const stockCount = readAuthUsers().length;
    const template = getRestockTemplate(guildId);
    const rendered = renderRestockTemplate(template, stockCount, farmId, addBotId);
    await ch.send({ content: rendered, embeds: [restockResult] });
  } catch (e) {
    console.error("[daily-restock] could not notify channel", e);
  }
}

async function scheduledRestockTick(client: Client): Promise<void> {
  const pending = readScheduledRestocks();
  if (pending.length === 0) return;
  const nowMs = Date.now();
  const due = pending.filter((s) => s.runAt <= nowMs);
  if (due.length === 0) return;
  writeScheduledRestocks(pending.filter((s) => s.runAt > nowMs));
  for (const s of due) {
    const restockResult = await doRestock(s.rawTokens);
    try {
      const ch = (await client.channels.fetch(s.channelId)) as TextChannel | null;
      if (!ch || !ch.isTextBased()) continue;
      const guildId = (ch as TextChannel).guild?.id ?? MAIN_GUILD_ID;
      const locks = readChannelLocks()[guildId] ?? {};
      const farmId = (locks as Record<string, string>).farm ?? null;
      const addBotId = (locks as Record<string, string>).addbot ?? null;
      const stockCount = readAuthUsers().length;
      const template = getRestockTemplate(guildId);
      const rendered = renderRestockTemplate(template, stockCount, farmId, addBotId);
      await ch.send({ content: rendered, embeds: [restockResult] });
    } catch (e) {
      console.error("[scheduled-restock] could not notify", e);
    }
  }
}

async function liveEmbedTick(client: Client, state: BotState): Promise<void> {
  for (const [type, ref] of [...state.liveMessages.entries()]) {
    try {
      const ch = (await client.channels.fetch(ref.channelId)) as TextChannel | null;
      if (!ch || !ch.isTextBased()) {
        state.liveMessages.delete(type);
        continue;
      }
      const msg = await ch.messages.fetch(ref.messageId);
      const embed =
        type === "stock" ? stockEmbed() : statusEmbed(client, state.botStartTime);
      await msg.edit({ embeds: [embed] });
    } catch {
      state.liveMessages.delete(type);
    }
  }
}
