import { CHANNEL_LOCKS_FILE } from "../config.js";
import { readJson, writeJson } from "./files.js";

export type LockType = "djoin" | "auth";

// { [guildId]: { djoin?: channelId, auth?: channelId } }
export type ChannelLocks = Record<string, Partial<Record<LockType, string>>>;

export function readChannelLocks(): ChannelLocks {
  return readJson<ChannelLocks>(CHANNEL_LOCKS_FILE, {});
}

export function setChannelLock(
  guildId: string,
  type: LockType,
  channelId: string,
): void {
  const all = readChannelLocks();
  all[guildId] = all[guildId] ?? {};
  all[guildId][type] = channelId;
  writeJson(CHANNEL_LOCKS_FILE, all);
}

export function clearChannelLock(guildId: string, type: LockType): boolean {
  const all = readChannelLocks();
  if (!all[guildId] || !(type in all[guildId])) return false;
  delete all[guildId][type];
  if (Object.keys(all[guildId]).length === 0) delete all[guildId];
  writeJson(CHANNEL_LOCKS_FILE, all);
  return true;
}

export function checkChannelLock(
  guildId: string,
  type: LockType,
  channelId: string,
): string | null {
  const locked = readChannelLocks()[guildId]?.[type];
  if (!locked) return null;
  return locked === channelId ? null : locked;
}
