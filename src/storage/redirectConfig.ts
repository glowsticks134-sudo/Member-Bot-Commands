import path from "node:path";
import { readJson, writeJson } from "./files.js";

// Avoid importing DATA_DIR from config.js to keep config.js free of cycles
// (config.js calls into this file via getRedirectUri()).
const DATA_DIR = path.resolve("artifacts/data");
const REDIRECT_CONFIG_FILE = path.join(DATA_DIR, "redirect_config.json");

interface RedirectConfig {
  url: string | null;
  updatedAt: string | null;
}

function read(): RedirectConfig {
  return readJson<RedirectConfig>(REDIRECT_CONFIG_FILE, {
    url: null,
    updatedAt: null,
  });
}

export function getSavedRedirect(): string | null {
  return read().url;
}

export function getSavedRedirectUpdatedAt(): string | null {
  return read().updatedAt;
}

export function saveRedirect(url: string): void {
  writeJson(REDIRECT_CONFIG_FILE, {
    url,
    updatedAt: new Date().toISOString(),
  });
}

export function clearSavedRedirect(): void {
  writeJson(REDIRECT_CONFIG_FILE, { url: null, updatedAt: null });
}
