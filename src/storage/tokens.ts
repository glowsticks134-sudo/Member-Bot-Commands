import { AUTHS_FILE, STORED_TOKENS_FILE } from "../config.js";
import { readLines, writeLines, appendLine } from "./files.js";

export interface AuthUser {
  userId: string;
  accessToken: string;
  refreshToken: string;
}

function parseLine(line: string): AuthUser | null {
  const parts = line.split(",");
  if (parts.length < 3) return null;
  const [userId, accessToken, refreshToken] = parts;
  if (!userId || !accessToken || !refreshToken) return null;
  return {
    userId: userId.trim(),
    accessToken: accessToken.trim(),
    refreshToken: refreshToken.trim(),
  };
}

function format(u: AuthUser): string {
  return `${u.userId},${u.accessToken},${u.refreshToken}`;
}

// Bulk-stock tokens (from /restock) — auths.txt
export function readAuthUsers(): AuthUser[] {
  return readLines(AUTHS_FILE)
    .map(parseLine)
    .filter((x): x is AuthUser => x !== null);
}

export function writeAuthUsers(users: AuthUser[]): void {
  writeLines(AUTHS_FILE, users.map(format));
}

export function appendAuthUser(u: AuthUser): void {
  appendLine(AUTHS_FILE, format(u));
}

export function clearAuthUsers(): void {
  writeLines(AUTHS_FILE, []);
}

// Personal tokens (from /auth or /get_token flow) — stored_tokens.txt
export function readStoredTokens(): AuthUser[] {
  return readLines(STORED_TOKENS_FILE)
    .map(parseLine)
    .filter((x): x is AuthUser => x !== null);
}

export function writeStoredTokens(users: AuthUser[]): void {
  writeLines(STORED_TOKENS_FILE, users.map(format));
}

export function saveUserAuth(
  userId: string,
  accessToken: string,
  refreshToken: string,
): void {
  const users = readStoredTokens();
  const idx = users.findIndex((u) => u.userId === userId);
  const entry: AuthUser = { userId, accessToken, refreshToken };
  if (idx >= 0) users[idx] = entry;
  else users.push(entry);
  writeStoredTokens(users);
}

export function findStoredToken(userId: string): AuthUser | undefined {
  return readStoredTokens().find((u) => u.userId === userId);
}

// Return tokens from stock back to stored_tokens (no duplicates)
export function returnTokensToStored(users: AuthUser[]): void {
  if (users.length === 0) return;
  const existing = readStoredTokens();
  const existingIds = new Set(existing.map((u) => u.userId));
  for (const u of users) {
    if (existingIds.has(u.userId)) {
      // Update the entry in case the token was refreshed during stock use
      const idx = existing.findIndex((e) => e.userId === u.userId);
      if (idx >= 0) existing[idx] = u;
    } else {
      existing.push(u);
      existingIds.add(u.userId);
    }
  }
  writeStoredTokens(existing);
}
