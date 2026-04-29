import {
  CLIENT_ID,
  CLIENT_SECRET,
  MAIN_GUILD_ID,
  BOT_TOKEN,
  getRedirectUri,
} from "./config.js";

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

const DISCORD_API = "https://discord.com/api/v10";

export async function exchangeCode(
  code: string,
): Promise<{ ok: true; data: TokenResponse } | { ok: false; error: string }> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
  });
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${text}` };
  try {
    return { ok: true, data: JSON.parse(text) as TokenResponse };
  } catch {
    return { ok: false, error: `Invalid JSON: ${text}` };
  }
}

export async function refreshToken(
  refreshTokenStr: string,
): Promise<{ ok: true; data: TokenResponse } | { ok: false; error: string }> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshTokenStr,
  });
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${text}` };
  try {
    return { ok: true, data: JSON.parse(text) as TokenResponse };
  } catch {
    return { ok: false, error: `Invalid JSON: ${text}` };
  }
}

export async function fetchOAuthUserId(accessToken: string): Promise<string | null> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { id?: string };
  return j.id ?? null;
}

/**
 * Returns one of:
 *  - "added"      → newly added to the guild
 *  - "in_guild"   → was already in the guild (HTTP 204)
 *  - "rate_limit" → 429
 *  - "error:<msg>"
 */
export async function addUserToGuild(
  userId: string,
  accessToken: string,
  guildId: string = MAIN_GUILD_ID,
): Promise<string> {
  const res = await fetch(
    `${DISCORD_API}/guilds/${guildId}/members/${userId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ access_token: accessToken }),
    },
  );
  if (res.status === 201) return "added";
  if (res.status === 204) return "in_guild";
  if (res.status === 429) return "rate_limit";
  const text = await res.text().catch(() => "");
  return `error:HTTP ${res.status}: ${text.slice(0, 200)}`;
}
