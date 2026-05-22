import path from "node:path";
import { DATA_DIR } from "../config.js";
import { readJson, writeJson } from "./files.js";

const RESTOCK_TEMPLATES_FILE = path.join(DATA_DIR, "restock_templates.json");

export const DEFAULT_TEMPLATE =
  "📦 **Restock!** `{count}` accounts are now available.\nFarm channel: {farm} | Add bot: {addbot}\n\nPowered by Memberk";

type TemplateStore = Record<string, string>;

export function getRestockTemplate(guildId: string): string {
  const store = readJson<TemplateStore>(RESTOCK_TEMPLATES_FILE, {});
  return store[guildId] ?? DEFAULT_TEMPLATE;
}

export function setRestockTemplate(guildId: string, template: string): void {
  const store = readJson<TemplateStore>(RESTOCK_TEMPLATES_FILE, {});
  store[guildId] = template;
  writeJson(RESTOCK_TEMPLATES_FILE, store);
}

export function resetRestockTemplate(guildId: string): void {
  const store = readJson<TemplateStore>(RESTOCK_TEMPLATES_FILE, {});
  delete store[guildId];
  writeJson(RESTOCK_TEMPLATES_FILE, store);
}

export function renderRestockTemplate(
  template: string,
  count: number,
  farmChannelId: string | null,
  addBotChannelId: string | null,
): string {
  return template
    .replace(/\{count\}/g, String(count))
    .replace(/\{farm\}/g, farmChannelId ? `<#${farmChannelId}>` : "not set")
    .replace(/\{addbot\}/g, addBotChannelId ? `<#${addBotChannelId}>` : "not set");
}
