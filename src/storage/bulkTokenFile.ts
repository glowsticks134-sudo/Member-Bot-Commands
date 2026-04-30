import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../config.js";

export const INCOMING_TOKENS_FILE = path.join(DATA_DIR, "incoming_tokens.txt");

export function readIncomingTokensRaw(): string {
  if (!fs.existsSync(INCOMING_TOKENS_FILE)) return "";
  return fs.readFileSync(INCOMING_TOKENS_FILE, "utf8");
}

export function clearIncomingTokens(): void {
  fs.writeFileSync(INCOMING_TOKENS_FILE, "", "utf8");
}

export function ensureIncomingTokensFile(): void {
  if (!fs.existsSync(INCOMING_TOKENS_FILE)) {
    fs.writeFileSync(
      INCOMING_TOKENS_FILE,
      [
        "# Drop tokens here, one per line, then run /load_tokens in Discord.",
        "# Format: userId,accessToken,refreshToken",
        "# Lines starting with # are ignored. Blank lines are ignored.",
        "",
      ].join("\n"),
      "utf8",
    );
  }
}

/**
 * Strip comment lines (starting with #) and blank lines so the result can be
 * fed straight into doRestock(). Returns both cleaned text and a count of
 * non-comment, non-blank lines for messaging.
 */
export function cleanIncomingTokens(raw: string): {
  cleaned: string;
  lineCount: number;
} {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  return { cleaned: lines.join("\n"), lineCount: lines.length };
}
