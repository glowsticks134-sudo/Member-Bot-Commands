import path from "node:path";
import { DATA_DIR } from "../config.js";
import { readJson, writeJson } from "./files.js";

const AUTOPING_FILE = path.join(DATA_DIR, "autoping.json");

export interface AutoPingConfig {
  channelId: string;
  message: string;
  mentionRoleId: string | null;
}

interface AutoPingFile {
  guilds: Record<string, AutoPingConfig>;
}

function read(): AutoPingFile {
  return readJson<AutoPingFile>(AUTOPING_FILE, { guilds: {} });
}

export function getAutoPing(guildId: string): AutoPingConfig | null {
  return read().guilds[guildId] ?? null;
}

export function setAutoPing(guildId: string, cfg: AutoPingConfig): void {
  const data = read();
  data.guilds[guildId] = cfg;
  writeJson(AUTOPING_FILE, data);
}

export function clearAutoPing(guildId: string): boolean {
  const data = read();
  if (!(guildId in data.guilds)) return false;
  delete data.guilds[guildId];
  writeJson(AUTOPING_FILE, data);
  return true;
}
