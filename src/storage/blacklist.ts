import path from "node:path";
import { DATA_DIR } from "../config.js";
import { readJson, writeJson } from "./files.js";

const BLACKLIST_FILE = path.join(DATA_DIR, "blacklist.json");

interface BlacklistFile {
  users: string[];
}

function read(): BlacklistFile {
  return readJson<BlacklistFile>(BLACKLIST_FILE, { users: [] });
}

export function listBlacklisted(): string[] {
  return read().users.slice();
}

export function isBlacklisted(userId: string): boolean {
  return read().users.includes(userId);
}

export function addBlacklisted(userId: string): boolean {
  const data = read();
  if (data.users.includes(userId)) return false;
  data.users.push(userId);
  writeJson(BLACKLIST_FILE, data);
  return true;
}

export function removeBlacklisted(userId: string): boolean {
  const data = read();
  if (!data.users.includes(userId)) return false;
  data.users = data.users.filter((u) => u !== userId);
  writeJson(BLACKLIST_FILE, data);
  return true;
}
