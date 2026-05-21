import { DATA_DIR } from "../config.js";
import * as path from "node:path";
import { readJson, writeJson } from "./files.js";

const STATUS_ROLES_FILE = path.join(DATA_DIR, "status_roles.json");

export interface StatusRoleConfig {
  inviteLink: string;
  roleId: string;
  logChannelId?: string;
}

type StatusRoleStore = Record<string, StatusRoleConfig>;

function read(): StatusRoleStore {
  return readJson<StatusRoleStore>(STATUS_ROLES_FILE, {});
}

function write(data: StatusRoleStore): void {
  writeJson(STATUS_ROLES_FILE, data);
}

export function getStatusRoleConfig(guildId: string): StatusRoleConfig | null {
  return read()[guildId] ?? null;
}

export function setStatusRoleConfig(guildId: string, cfg: StatusRoleConfig): void {
  const all = read();
  all[guildId] = cfg;
  write(all);
}

export function setLogChannel(guildId: string, channelId: string): boolean {
  const all = read();
  if (!all[guildId]) return false;
  all[guildId].logChannelId = channelId;
  write(all);
  return true;
}

export function clearStatusRoleConfig(guildId: string): boolean {
  const all = read();
  if (!all[guildId]) return false;
  delete all[guildId];
  write(all);
  return true;
}
