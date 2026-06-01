import { EmbedBuilder, type Client } from "discord.js";
import { COLOR, MAIN_GUILD_ID } from "../config.js";
import { addUserToGuild, fetchOAuthUserId, refreshToken } from "../oauth.js";
import { getVerifyClient } from "./verifyBot.js";
import {
  readStoredTokens,
  writeStoredTokens,
  type AuthUser,
} from "../storage/tokens.js";

export type ProgressFn = (text: string) => Promise<void> | void;

// ─── Check Tokens ─────────────────────────────────────────────────────────────
// Reads stored_tokens.txt, validates each token (refreshing expired ones),
// and writes the updated list back in place.

export async function doCheckTokens(): Promise<EmbedBuilder> {
  const users = readStoredTokens();
  if (users.length === 0) {
    return new EmbedBuilder()
      .setTitle("🔍 Check Tokens")
      .setDescription("No stored tokens to check.")
      .setColor(COLOR.yellow);
  }

  let valid = 0;
  let refreshed = 0;
  let invalid = 0;
  const kept: AuthUser[] = [];

  for (const u of users) {
    const id = await fetchOAuthUserId(u.accessToken);
    if (id) {
      valid++;
      kept.push(u);
      continue;
    }
    // Token expired — try refreshing
    const r = await refreshToken(u.refreshToken);
    if (r.ok) {
      refreshed++;
      kept.push({
        userId: u.userId,
        accessToken: r.data.access_token,
        refreshToken: r.data.refresh_token,
      });
    } else {
      invalid++;
      // Remove invalid token from stored
    }
    await new Promise((res) => setTimeout(res, 60));
  }

  writeStoredTokens(kept);

  return new EmbedBuilder()
    .setTitle("🔍 Token Check Complete")
    .setColor(COLOR.blurple)
    .setTimestamp(new Date())
    .addFields(
      { name: "✅ Valid", value: String(valid), inline: true },
      { name: "♻️ Refreshed", value: String(refreshed), inline: true },
      { name: "❌ Removed", value: String(invalid), inline: true },
      { name: "📦 Remaining", value: String(kept.length), inline: true },
    );
}

// ─── Mass Join ────────────────────────────────────────────────────────────────
// Reads stored_tokens.txt, joins all users to the target server,
// refreshes any expired tokens in place, and saves the updated list.

export async function doMassJoin(
  serverId: string,
  client: Client,
  onProgress?: ProgressFn,
  amount?: number,
): Promise<EmbedBuilder | null> {
  if (!/^\d+$/.test(serverId)) {
    return new EmbedBuilder()
      .setTitle("❌ Invalid Server ID")
      .setDescription("Server ID must be numeric.")
      .setColor(COLOR.red);
  }

  const activeClient = getVerifyClient() ?? client;
  const guild = activeClient.guilds.cache.get(serverId)
    ?? await activeClient.guilds.fetch(serverId).catch(() => null);
  if (!guild) {
    return new EmbedBuilder()
      .setTitle("❌ Verification Bot Not in Server")
      .setDescription(`The verification bot is not in server \`${serverId}\`. Add it first, then try again.`)
      .setColor(COLOR.red);
  }

  const allUsers = readStoredTokens();
  const users = amount != null ? allUsers.slice(0, amount) : allUsers;
  if (users.length === 0) {
    return new EmbedBuilder()
      .setTitle("📭 No Authenticated Users")
      .setDescription("No users have authenticated yet.\n\nShare `/get_token` so members can authorize their accounts.")
      .setColor(COLOR.yellow);
  }

  let added = 0;
  let inGuild = 0;
  let failed = 0;
  let rateLimited = 0;
  const updated: AuthUser[] = [];

  for (let i = 0; i < users.length; i++) {
    const u = { ...users[i] };
    let result = await addUserToGuild(u.userId, u.accessToken, serverId);

    // If expired, try refreshing once
    if (result.startsWith("error:") || result === "rate_limit") {
      if (u.refreshToken) {
        const r = await refreshToken(u.refreshToken);
        if (r.ok) {
          u.accessToken = r.data.access_token;
          u.refreshToken = r.data.refresh_token;
          result = await addUserToGuild(u.userId, u.accessToken, serverId);
        }
      }
    }

    if (result === "added") {
      added++;
    } else if (result === "in_guild") {
      inGuild++;
    } else if (result === "rate_limit") {
      rateLimited++;
      await new Promise((res) => setTimeout(res, 1500));
    } else {
      failed++;
    }

    // Always keep the token (even failed — might work later)
    updated.push(u);

    if (onProgress && (i % 5 === 0 || i === users.length - 1)) {
      await onProgress(
        `⏳ Mass join: ${i + 1}/${users.length} — ✅ ${added} added, 👤 ${inGuild} already in, ❌ ${failed} failed`,
      );
    }

    await new Promise((res) => setTimeout(res, 120));
  }

  // Write back with any refreshed tokens
  writeStoredTokens(updated);

  return new EmbedBuilder()
    .setTitle("🚀 Mass Join Complete")
    .setColor(added > 0 ? COLOR.green : COLOR.yellow)
    .setTimestamp(new Date())
    .addFields(
      { name: "🎯 Server", value: `${guild.name}\n\`${serverId}\``, inline: true },
      { name: "✅ Added", value: String(added), inline: true },
      { name: "👤 Already in", value: String(inGuild), inline: true },
      { name: "❌ Failed", value: String(failed), inline: true },
      { name: "⏸️ Rate-limited", value: String(rateLimited), inline: true },
      { name: "📦 Total tokens", value: String(updated.length), inline: true },
    );
}

// ─── Cleanup Servers ──────────────────────────────────────────────────────────
// Leave all non-main servers immediately (manual cleanup).

export async function doCleanupServers(
  client: Client,
  currentGuildId: string,
): Promise<EmbedBuilder> {
  const toLeave = [...client.guilds.cache.values()].filter(
    (g) => g.id !== MAIN_GUILD_ID && g.id !== currentGuildId,
  );
  let left = 0;
  let failed = 0;
  for (const g of toLeave) {
    try {
      await g.leave();
      left++;
    } catch {
      failed++;
    }
  }
  return new EmbedBuilder()
    .setTitle("🧹 Cleanup Complete")
    .setColor(COLOR.green)
    .setTimestamp(new Date())
    .addFields(
      { name: "👋 Left", value: String(left), inline: true },
      { name: "❌ Failed", value: String(failed), inline: true },
      { name: "🌐 Remaining", value: String(client.guilds.cache.size), inline: true },
    );
}
