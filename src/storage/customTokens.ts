import fs from "node:fs";
import { CUSTOM_TOKENS_FILE, CUSTOM_TOKENS_CLAIMED_FILE } from "../config.js";
import { readLines, writeLines } from "./files.js";
import { readJson, writeJson } from "./files.js";

// ── Pool ──────────────────────────────────────────────────────────────────────

export function readPool(): string[] {
  return readLines(CUSTOM_TOKENS_FILE);
}

function writePool(lines: string[]): void {
  writeLines(CUSTOM_TOKENS_FILE, lines);
}

export function poolSize(): number {
  return readPool().length;
}

/** Add tokens to the pool. Returns how many were added. */
export function insertTokens(tokens: string[]): number {
  const clean = tokens.map((t) => t.trim()).filter(Boolean);
  if (clean.length === 0) return 0;
  const existing = new Set(readPool());
  const toAdd = clean.filter((t) => !existing.has(t));
  if (toAdd.length === 0) return 0;
  try {
    fs.mkdirSync(require_dir(CUSTOM_TOKENS_FILE), { recursive: true });
  } catch { /* dir exists */ }
  for (const t of toAdd) {
    try { fs.appendFileSync(CUSTOM_TOKENS_FILE, t + "\n"); } catch { /* noop */ }
  }
  return toAdd.length;
}

function require_dir(file: string): string {
  return file.split("/").slice(0, -1).join("/");
}

/** Pop `n` tokens from the front of the pool. Returns the popped tokens. */
export function claimTokens(n: number): string[] {
  const pool = readPool();
  if (pool.length === 0) return [];
  const taken = pool.splice(0, n);
  writePool(pool);
  return taken;
}

export function clearPool(): void {
  writePool([]);
}

// ── Claim tracking ────────────────────────────────────────────────────────────
// Tracks how many total tokens each user has ever claimed, so owners can see.

type ClaimRecord = Record<string, number>;

function readClaimed(): ClaimRecord {
  return readJson<ClaimRecord>(CUSTOM_TOKENS_CLAIMED_FILE, {});
}

function writeClaimed(r: ClaimRecord): void {
  writeJson(CUSTOM_TOKENS_CLAIMED_FILE, r);
}

export function recordClaim(userId: string, count: number): void {
  const r = readClaimed();
  r[userId] = (r[userId] ?? 0) + count;
  writeClaimed(r);
}

export function getClaimCount(userId: string): number {
  return readClaimed()[userId] ?? 0;
}

export function clearClaims(): void {
  writeClaimed({});
}
