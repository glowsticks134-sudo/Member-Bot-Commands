import path from "node:path";
import { DATA_DIR } from "../config.js";
import { readJson, writeJson } from "./files.js";

const ALLOWED_GUILDS_FILE = path.join(DATA_DIR, "allowed_guilds.json");

interface AllowedGuildsFile {
  guilds: string[];
}

function read(): AllowedGuildsFile {
  return readJson<AllowedGuildsFile>(ALLOWED_GUILDS_FILE, { guilds: [] });
}

export function listAllowedGuilds(): string[] {
  return read().guilds.slice();
}

export function isAllowedGuild(guildId: string): boolean {
  return read().guilds.includes(guildId);
}

export function addAllowedGuild(guildId: string): boolean {
  const data = read();
  if (data.guilds.includes(guildId)) return false;
  data.guilds.push(guildId);
  writeJson(ALLOWED_GUILDS_FILE, data);
  return true;
}

export function removeAllowedGuild(guildId: string): boolean {
  const data = read();
  if (!data.guilds.includes(guildId)) return false;
  data.guilds = data.guilds.filter((g) => g !== guildId);
  writeJson(ALLOWED_GUILDS_FILE, data);
  return true;
}
