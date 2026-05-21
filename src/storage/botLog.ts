import { DATA_DIR } from "../config.js";
import * as path from "node:path";
import { readJson, writeJson } from "./files.js";

const BOT_LOG_FILE = path.join(DATA_DIR, "bot_log.json");

interface BotLogStore {
  [guildId: string]: { logChannelId: string };
}

function read(): BotLogStore {
  return readJson<BotLogStore>(BOT_LOG_FILE, {});
}

function write(data: BotLogStore): void {
  writeJson(BOT_LOG_FILE, data);
}

export function getBotLogChannel(guildId: string): string | null {
  return read()[guildId]?.logChannelId ?? null;
}

export function setBotLogChannel(guildId: string, channelId: string): void {
  const all = read();
  all[guildId] = { logChannelId: channelId };
  write(all);
}

export function clearBotLogChannel(guildId: string): boolean {
  const all = read();
  if (!all[guildId]) return false;
  delete all[guildId];
  write(all);
  return true;
}
