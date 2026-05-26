import fs from "node:fs";
import { LIVE_MESSAGES_FILE } from "../config.js";
import type { LiveMessageRef } from "../bot/client.js";

type LiveMessagesStore = Record<string, LiveMessageRef>;

export function readLiveMessages(): Map<string, LiveMessageRef> {
  try {
    const raw = fs.readFileSync(LIVE_MESSAGES_FILE, "utf8");
    const obj = JSON.parse(raw) as LiveMessagesStore;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

export function writeLiveMessages(map: Map<string, LiveMessageRef>): void {
  try {
    const obj: LiveMessagesStore = {};
    for (const [k, v] of map.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(LIVE_MESSAGES_FILE, JSON.stringify(obj, null, 2), "utf8");
  } catch (e) {
    console.error("[live-messages] failed to write", e);
  }
}

export function setLiveMessage(map: Map<string, LiveMessageRef>, type: string, ref: LiveMessageRef): void {
  map.set(type, ref);
  writeLiveMessages(map);
}

export function deleteLiveMessage(map: Map<string, LiveMessageRef>, type: string): void {
  map.delete(type);
  writeLiveMessages(map);
}
