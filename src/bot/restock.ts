import { EmbedBuilder, type Client } from "discord.js";
import { COLOR, MAIN_GUILD_ID } from "../config.js";
import { addUserToGuild, fetchOAuthUserId, refreshToken } from "../oauth.js";
import {
  appendAuthUser,
  clearAuthUsers,
  readAuthUsers,
  writeAuthUsers,
  returnTokensToStored,
  type AuthUser,
} from "../storage/tokens.js";

function parseTokenLines(raw: string): AuthUser[] {
  const out: AuthUser[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(",");
    if (parts.length < 3) continue;
    const [userId, accessToken, refreshTokenStr] = parts;
    if (!userId?.trim() || !accessToken?.trim() || !refreshTokenStr?.trim()) continue;
    out.push({
      userId: userId.trim(),
      accessToken: accessToken.trim(),
      refreshToken: refreshTokenStr.trim(),
    });
  }
  return out;
}

export async function doRestock(raw: string): Promise<EmbedBuilder> {
  const newOnes = parseTokenLines(raw);
  if (newOnes.length === 0) {
    return new EmbedBuilder()
      .setTitle("⚠️ Restock Failed")
      .setDescription(
        "No valid token lines found.\nFormat: `userId,accessToken,refreshToken`",
      )
      .setColor(COLOR.yellow);
  }
  const existing = readAuthUsers();
  const existingIds = new Set(existing.map((u) => u.userId));
  let added = 0;
  let dupes = 0;
  for (const u of newOnes) {
    if (existingIds.has(u.userId)) {
      dupes++;
      continue;
    }
    appendAuthUser(u);
    existingIds.add(u.userId);
    added++;
  }
  return new EmbedBuilder()
    .setTitle("📦 Restock Complete")
    .setColor(COLOR.green)
    .setTimestamp(new Date())
    .addFields(
      { name: "✅ Added", value: String(added), inline: true },
      { name: "🔁 Duplicates skipped", value: String(dupes), inline: true },
      { name: "📦 Total in stock", value: String(readAuthUsers().length), inline: true },
    );
}

export function clearStock(): void {
  const current = readAuthUsers();
  returnTokensToStored(current);
  clearAuthUsers();
}

// Move stored OAuth tokens (stored_tokens.txt) into bulk stock (auths.txt)
// Pass a count to move only N tokens; omit to move all.
export async function doRestockFromStored(count?: number): Promise<EmbedBuilder> {
  const { readStoredTokens } = await import("../storage/tokens.js");
  const stored = readStoredTokens();
  if (stored.length === 0) {
    return new EmbedBuilder()
      .setTitle("⚠️ No Stored Tokens")
      .setDescription(
        "There are no authenticated users to restock from.\n\nUsers need to authorize via `/get_token` first.",
      )
      .setColor(COLOR.yellow);
  }
  const existing = readAuthUsers();
  const existingIds = new Set(existing.map((u) => u.userId));
  // Filter to only tokens not already in stock, then slice to count
  const eligible = stored.filter((u) => !existingIds.has(u.userId));
  const toAdd = count != null ? eligible.slice(0, count) : eligible;
  const dupes = stored.length - eligible.length;
  for (const u of toAdd) {
    appendAuthUser(u);
  }
  const skippedByCount = eligible.length - toAdd.length;
  const fields = [
    { name: "✅ Added to Stock", value: String(toAdd.length), inline: true },
    { name: "🔁 Already in Stock", value: String(dupes), inline: true },
    { name: "📦 Total in Stock", value: String(readAuthUsers().length), inline: true },
  ];
  if (skippedByCount > 0) {
    fields.push({ name: "⏭️ Left in Stored", value: String(skippedByCount), inline: true });
  }
  return new EmbedBuilder()
    .setTitle("📦 Restock Complete")
    .setColor(COLOR.green)
    .setTimestamp(new Date())
    .addFields(...fields);
}

export async function doAddToken(raw: string): Promise<EmbedBuilder> {
  const parsed = parseTokenLines(raw);
  if (parsed.length === 0) {
    return new EmbedBuilder()
      .setTitle("⚠️ Invalid Token")
      .setDescription("Format: `userId,accessToken,refreshToken`")
      .setColor(COLOR.yellow);
  }
  const u = parsed[0];
  const existing = readAuthUsers();
  if (existing.some((x) => x.userId === u.userId)) {
    return new EmbedBuilder()
      .setTitle("ℹ️ Already in Stock")
      .setDescription(`<@${u.userId}> is already stored.`)
      .setColor(COLOR.yellow);
  }
  appendAuthUser(u);
  return new EmbedBuilder()
    .setTitle("✅ Token Added")
    .setDescription(`Added <@${u.userId}> to bulk stock.`)
    .setColor(COLOR.green);
}

export async function doCheckTokens(): Promise<EmbedBuilder> {
  const users = readAuthUsers();
  if (users.length === 0) {
    return new EmbedBuilder()
      .setTitle("🔍 Check Tokens")
      .setDescription("No tokens to check.")
      .setColor(COLOR.yellow);
  }
  let valid = 0;
  let invalid = 0;
  let refreshed = 0;
  const kept: AuthUser[] = [];

  const returnToStored: AuthUser[] = [];
  for (const u of users) {
    const id = await fetchOAuthUserId(u.accessToken);
    if (id) {
      valid++;
      kept.push(u);
      continue;
    }
    // Try refresh
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
      returnToStored.push(u); // return invalid tokens to stored instead of deleting
    }
    await new Promise((res) => setTimeout(res, 60));
  }
  writeAuthUsers(kept);
  if (returnToStored.length > 0) returnTokensToStored(returnToStored);
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

export type ProgressFn = (text: string) => Promise<void> | void;

export async function doMassJoin(
  serverId: string,
  client: Client,
  onProgress?: ProgressFn,
): Promise<EmbedBuilder | null> {
  if (!/^\d+$/.test(serverId)) {
    return new EmbedBuilder()
      .setTitle("❌ Invalid Server ID")
      .setDescription("Server ID must be numeric.")
      .setColor(COLOR.red);
  }
  const guild = client.guilds.cache.get(serverId);
  if (!guild) {
    return new EmbedBuilder()
      .setTitle("❌ Bot Not in Server")
      .setDescription(
        `Bot is not a member of server \`${serverId}\`. Invite it first.`,
      )
      .setColor(COLOR.red);
  }
  const users = readAuthUsers();
  if (users.length === 0) {
    return new EmbedBuilder()
      .setTitle("📦 Out of Stock")
      .setDescription("No tokens in stock to mass-join. Use `/restock`.")
      .setColor(COLOR.yellow);
  }
  let added = 0;
  let inGuild = 0;
  let failed = 0;
  let rateLimited = 0;
  const kept: AuthUser[] = [];
  const returned: AuthUser[] = [];

  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    let token = u.accessToken;
    let result = await addUserToGuild(u.userId, token, serverId);

    if (result.startsWith("error:") || result === "rate_limit") {
      // Try refresh once
      const r = await refreshToken(u.refreshToken);
      if (r.ok) {
        token = r.data.access_token;
        u.accessToken = token;
        u.refreshToken = r.data.refresh_token;
        result = await addUserToGuild(u.userId, token, serverId);
      }
    }

    if (result === "added") {
      added++;
      kept.push(u);
    } else if (result === "in_guild") {
      inGuild++;
      kept.push(u);
    } else if (result === "rate_limit") {
      rateLimited++;
      kept.push(u);
      await new Promise((res) => setTimeout(res, 1500));
    } else {
      failed++;
      returned.push(u); // return failed token to stored instead of deleting
    }

    if (onProgress && (i % 5 === 0 || i === users.length - 1)) {
      await onProgress(
        `⏳ Mass join: ${i + 1}/${users.length} — ✅ ${added} added, 👤 ${inGuild} already in, ❌ ${failed} returned to stored`,
      );
    }
    await new Promise((res) => setTimeout(res, 120));
  }
  writeAuthUsers(kept);
  if (returned.length > 0) returnTokensToStored(returned);

  return new EmbedBuilder()
    .setTitle("🚀 Mass Join Complete")
    .setColor(added > 0 ? COLOR.green : COLOR.yellow)
    .setTimestamp(new Date())
    .addFields(
      { name: "🎯 Server", value: `${guild.name}\n\`${serverId}\``, inline: true },
      { name: "✅ Added", value: String(added), inline: true },
      { name: "👤 Already in", value: String(inGuild), inline: true },
      { name: "❌ Removed", value: String(failed), inline: true },
      { name: "⏸️ Rate-limited", value: String(rateLimited), inline: true },
      { name: "📦 Remaining stock", value: String(kept.length), inline: true },
    );
}

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
      {
        name: "🌐 Remaining",
        value: String(client.guilds.cache.size),
        inline: true,
      },
    );
}
