import { DATA_DIR } from "../config.js";
import * as path from "node:path";
import { readJson, writeJson } from "./files.js";

const TIER_ROLES_FILE = path.join(DATA_DIR, "tier_roles.json");

export const TIERS = ["bronze", "silver", "gold", "premium", "diamond", "emerald", "obsidian"] as const;
export type Tier = typeof TIERS[number];

export const TIER_LABELS: Record<Tier, string> = {
  bronze:   "🥉 Bronze",
  silver:   "🥈 Silver",
  gold:     "🥇 Gold",
  premium:  "💎 Premium",
  diamond:  "💠 Diamond",
  emerald:  "🟢 Emerald",
  obsidian: "⬛ Obsidian",
};

export type TierRoleMap = Partial<Record<Tier, string>>;
type AllGuilds = Record<string, TierRoleMap>;

function read(): AllGuilds {
  return readJson<AllGuilds>(TIER_ROLES_FILE, {});
}

function write(data: AllGuilds): void {
  writeJson(TIER_ROLES_FILE, data);
}

export function getTierRoles(guildId: string): TierRoleMap {
  return read()[guildId] ?? {};
}

export function setTierRoles(guildId: string, updates: TierRoleMap): TierRoleMap {
  const all = read();
  all[guildId] = { ...(all[guildId] ?? {}), ...updates };
  write(all);
  return all[guildId]!;
}

export function clearTierRole(guildId: string, tier: Tier): void {
  const all = read();
  if (all[guildId]) delete all[guildId][tier];
  write(all);
}
