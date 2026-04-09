import * as fs from "fs";

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; refresh_token: string } | null> {
  try {
    const data = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    const res = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: data.toString(),
    });

    if (res.ok) {
      return (await res.json()) as { access_token: string; refresh_token: string };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getValidToken(
  userId: string,
  accessToken: string,
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  // Test current token
  const testRes = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (testRes.ok) return accessToken;

  // Refresh
  const newTokens = await refreshAccessToken(refreshToken, clientId, clientSecret);
  if (newTokens) return newTokens.access_token;

  return null;
}

export function updateTokenInFile(filePath: string, userId: string, newAccessToken: string, newRefreshToken: string) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean);
  const updated = lines.map((line) => {
    if (line.startsWith(`${userId},`)) {
      return `${userId},${newAccessToken},${newRefreshToken}`;
    }
    return line;
  });
  fs.writeFileSync(filePath, updated.join("\n") + "\n");
}
