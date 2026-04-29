import { ROLE_LIMITS_FILE } from "../config.js";
import { readJson, writeJson } from "./files.js";

// { [guildId]: { [roleId]: limit } }
type RoleLimits = Record<string, Record<string, number>>;

export function readRoleLimits(): RoleLimits {
  return readJson<RoleLimits>(ROLE_LIMITS_FILE, {});
}

export function writeRoleLimits(value: RoleLimits): void {
  writeJson(ROLE_LIMITS_FILE, value);
}

export function getGuildRoleLimits(
  guildId: string,
): Record<string, number> {
  return readRoleLimits()[guildId] ?? {};
}

export function setGuildRoleLimit(
  guildId: string,
  roleId: string,
  limit: number,
): void {
  const all = readRoleLimits();
  all[guildId] = all[guildId] ?? {};
  all[guildId][roleId] = limit;
  writeRoleLimits(all);
}

export function removeGuildRoleLimit(guildId: string, roleId: string): boolean {
  const all = readRoleLimits();
  if (!all[guildId] || !(roleId in all[guildId])) return false;
  delete all[guildId][roleId];
  if (Object.keys(all[guildId]).length === 0) delete all[guildId];
  writeRoleLimits(all);
  return true;
}
