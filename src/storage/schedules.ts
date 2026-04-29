import {
  DAILY_RESTOCK_FILE,
  SCHEDULED_RESTOCKS_FILE,
} from "../config.js";
import { readJson, writeJson } from "./files.js";

export interface ScheduledRestock {
  id: string;
  runAt: number; // epoch ms
  rawTokens: string;
  channelId: string;
  createdBy: string;
}

export interface DailyRestock {
  time: string; // HH:MM in MST
  rawTokens: string;
  channelId: string;
  createdBy: string;
  lastRanDate: string | null;
}

export function readScheduledRestocks(): ScheduledRestock[] {
  return readJson<ScheduledRestock[]>(SCHEDULED_RESTOCKS_FILE, []);
}

export function writeScheduledRestocks(value: ScheduledRestock[]): void {
  writeJson(SCHEDULED_RESTOCKS_FILE, value);
}

export function addScheduledRestock(s: ScheduledRestock): void {
  const all = readScheduledRestocks();
  all.push(s);
  writeScheduledRestocks(all);
}

export function removeScheduledRestock(id: string): boolean {
  const all = readScheduledRestocks();
  const next = all.filter((s) => s.id !== id);
  if (next.length === all.length) return false;
  writeScheduledRestocks(next);
  return true;
}

export function readDailyRestock(): DailyRestock | null {
  return readJson<DailyRestock | null>(DAILY_RESTOCK_FILE, null);
}

export function writeDailyRestock(value: DailyRestock | null): void {
  writeJson(DAILY_RESTOCK_FILE, value);
}
