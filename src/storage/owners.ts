import { OWNER_ROLES_FILE } from "../config.js";
import { readJson, writeJson } from "./files.js";

// { [guildId]: roleId[] }
type OwnerRoles = Record<string, string[]>;

export function readOwnerRoles(): OwnerRoles {
  return readJson<OwnerRoles>(OWNER_ROLES_FILE, {});
}

export function getGuildOwnerRoles(guildId: string): string[] {
  return readOwnerRoles()[guildId] ?? [];
}

export function addGuildOwnerRole(
  guildId: string,
  roleId: string,
): boolean {
  const all = readOwnerRoles();
  all[guildId] = all[guildId] ?? [];
  if (all[guildId].includes(roleId)) return false;
  all[guildId].push(roleId);
  writeJson(OWNER_ROLES_FILE, all);
  return true;
}

export function removeGuildOwnerRole(
  guildId: string,
  roleId: string,
): boolean {
  const all = readOwnerRoles();
  if (!all[guildId] || !all[guildId].includes(roleId)) return false;
  all[guildId] = all[guildId].filter((r) => r !== roleId);
  if (all[guildId].length === 0) delete all[guildId];
  writeJson(OWNER_ROLES_FILE, all);
  return true;
}
