import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
} from "discord.js";
import {
  CLIENT_ID,
  COLOR,
  HARDCODED_OWNERS,
  MAIN_GUILD_ID,
  getRedirectUri,
} from "../config.js";
import { readStoredTokens, readAuthUsers } from "../storage/tokens.js";
import { listBlacklisted } from "../storage/blacklist.js";
import { listAllowedGuilds } from "../storage/allowedGuilds.js";
import { getGuildOwnerRoles } from "../storage/owners.js";

// ─── Help ──────────────────────────────────────────────────────────────────────

export function helpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🤖 Memberk Bot — Commands")
    .setColor(COLOR.blurple)
    .addFields(
      {
        name: "🔐 Verification Bot (Bot 2)",
        value: [
          "`/get_token` — Get your OAuth verification link",
          "`/auth code:` — Manual OAuth auth (fallback)",
          "`/send_verify` — Post the verification embed (owners only)",
        ].join("\n"),
        inline: false,
      },
      {
        name: "🔓 Everyone",
        value: [
          "`/count` — Show number of authenticated users",
          "`/list_users` — List all authenticated users",
          "`/servers` — List servers the bot is in",
          "`/server_age [server_id]` — Check how long bot has been in a server",
          "`/invite` — Bot invite link",
          "`/help` — This message",
        ].join("\n"),
        inline: false,
      },
      {
        name: "👑 Owner Only",
        value: [
          "`/djoin server_id:` — Mass-join all users to a server",
          "`/check_tokens` — Check & refresh all stored tokens",
        ].join("\n"),
        inline: false,
      },
      {
        name: "🔒 Super-Owner Only",
        value: [
          "`/blacklist user_id:` — Blacklist a user",
          "`/unblacklist user_id:` — Remove from blacklist",
          "`/blacklist_list` — Show blacklisted users",
          "`/enable_server server_id:` — Allow another server to use the bot",
          "`/disable_server server_id:` — Disable a server",
          "`/list_allowed_servers` — List allowed servers",
        ].join("\n"),
        inline: false,
      },
    )
    .setFooter({ text: "Prefix: ! — e.g. !help, !count, !djoin SERVER_ID" })
    .setTimestamp();
}

// ─── Users ─────────────────────────────────────────────────────────────────────

export function listUsersEmbed(): EmbedBuilder {
  const users = readStoredTokens();
  if (users.length === 0) {
    return new EmbedBuilder()
      .setTitle("👥 Authenticated Users")
      .setDescription("No users have authenticated yet.\n\nShare `/get_token` so members can authorize their accounts.")
      .setColor(COLOR.yellow)
      .setTimestamp();
  }
  const LIMIT = 30;
  const shown = users.slice(0, LIMIT);
  const lines = shown.map((u, i) => `\`${i + 1}.\` <@${u.userId}> \`${u.userId}\``);
  if (users.length > LIMIT) lines.push(`…and **${users.length - LIMIT}** more`);
  return new EmbedBuilder()
    .setTitle(`👥 Authenticated Users (${users.length})`)
    .setDescription(lines.join("\n"))
    .setColor(COLOR.blurple)
    .setTimestamp();
}

// ─── Servers ───────────────────────────────────────────────────────────────────

export function serversEmbed(
  client: Client,
  serverJoinTimes: Map<string, Date>,
): EmbedBuilder {
  const guilds = [...client.guilds.cache.values()];
  if (guilds.length === 0) {
    return new EmbedBuilder()
      .setTitle("🌐 Servers")
      .setDescription("Bot is not in any servers.")
      .setColor(COLOR.yellow)
      .setTimestamp();
  }
  const LIMIT = 20;
  const shown = guilds.slice(0, LIMIT);
  const now = Date.now();
  const lines = shown.map((g) => {
    const joined = serverJoinTimes.get(g.id);
    const days = joined ? Math.floor((now - joined.getTime()) / 86_400_000) : "?";
    const label = g.id === MAIN_GUILD_ID ? " ⭐" : "";
    return `**${g.name}**${label} \`${g.id}\` — ${days}d — ${g.memberCount} members`;
  });
  if (guilds.length > LIMIT) lines.push(`…and **${guilds.length - LIMIT}** more`);
  return new EmbedBuilder()
    .setTitle(`🌐 Servers (${guilds.length})`)
    .setDescription(lines.join("\n"))
    .setColor(COLOR.blurple)
    .setTimestamp();
}

export function serverAgeEmbed(
  serverId: string | null | undefined,
  client: Client,
  serverJoinTimes: Map<string, Date>,
): EmbedBuilder {
  const now = Date.now();

  if (serverId) {
    const g = client.guilds.cache.get(serverId);
    if (!g) {
      return new EmbedBuilder()
        .setTitle("❌ Server Not Found")
        .setDescription(`Bot is not in server \`${serverId}\`.`)
        .setColor(COLOR.red)
        .setTimestamp();
    }
    const joined = serverJoinTimes.get(serverId);
    const days = joined ? Math.floor((now - joined.getTime()) / 86_400_000) : null;
    return new EmbedBuilder()
      .setTitle(`📅 Server Age — ${g.name}`)
      .setColor(COLOR.blurple)
      .addFields(
        { name: "🏠 Server", value: `**${g.name}** \`${g.id}\``, inline: true },
        { name: "📅 Days in Server", value: days !== null ? `${days} day(s)` : "Unknown", inline: true },
        { name: "👥 Members", value: String(g.memberCount), inline: true },
        {
          name: "⏱️ Auto-leave in",
          value: g.id === MAIN_GUILD_ID ? "Never (main server)" : days !== null ? `${Math.max(0, 14 - days)} day(s)` : "Unknown",
          inline: true,
        },
      )
      .setTimestamp();
  }

  // All servers
  const guilds = [...client.guilds.cache.values()];
  if (guilds.length === 0) {
    return new EmbedBuilder()
      .setTitle("📅 Server Age")
      .setDescription("Bot is not in any servers.")
      .setColor(COLOR.yellow)
      .setTimestamp();
  }
  const LIMIT = 15;
  const sorted = guilds
    .map((g) => ({
      g,
      days: serverJoinTimes.has(g.id)
        ? Math.floor((now - serverJoinTimes.get(g.id)!.getTime()) / 86_400_000)
        : 999,
    }))
    .sort((a, b) => b.days - a.days)
    .slice(0, LIMIT);
  const lines = sorted.map(({ g, days }) => {
    const label = g.id === MAIN_GUILD_ID ? " ⭐" : "";
    const countdown =
      g.id === MAIN_GUILD_ID ? "∞ (main)" : `${Math.max(0, 14 - days)}d left`;
    return `**${g.name}**${label} — **${days === 999 ? "?" : days}d** old — ${countdown}`;
  });
  if (guilds.length > LIMIT) lines.push(`…and **${guilds.length - LIMIT}** more`);
  return new EmbedBuilder()
    .setTitle(`📅 Server Ages (${guilds.length} servers)`)
    .setDescription(lines.join("\n"))
    .setColor(COLOR.blurple)
    .setFooter({ text: "Bot auto-leaves non-main servers after 14 days" })
    .setTimestamp();
}

// ─── Status ────────────────────────────────────────────────────────────────────

export function statusEmbed(client: Client, startTime: Date | null): EmbedBuilder {
  const upMs = startTime ? Date.now() - startTime.getTime() : 0;
  const upHours = Math.floor(upMs / 3_600_000);
  const upMins = Math.floor((upMs % 3_600_000) / 60_000);
  const stored = readStoredTokens().length;
  return new EmbedBuilder()
    .setTitle("🤖 Bot Status")
    .setColor(COLOR.green)
    .addFields(
      { name: "🏷️ Tag", value: client.user?.tag ?? "Unknown", inline: true },
      { name: "⏱️ Uptime", value: `${upHours}h ${upMins}m`, inline: true },
      { name: "🌐 Servers", value: String(client.guilds.cache.size), inline: true },
      { name: "👥 Authenticated", value: String(stored), inline: true },
      { name: "📡 Latency", value: `${client.ws.ping}ms`, inline: true },
    )
    .setTimestamp();
}

// ─── Blacklist ─────────────────────────────────────────────────────────────────

export function blacklistListEmbed(): EmbedBuilder {
  const list = listBlacklisted();
  if (list.length === 0) {
    return new EmbedBuilder()
      .setTitle("📋 Blacklist")
      .setDescription("No users are currently blacklisted.")
      .setColor(COLOR.green)
      .setTimestamp();
  }
  const lines = list.map((id: string, i: number) => `\`${i + 1}.\` <@${id}> \`${id}\``);
  return new EmbedBuilder()
    .setTitle(`📋 Blacklist (${list.length})`)
    .setDescription(lines.join("\n"))
    .setColor(COLOR.red)
    .setTimestamp();
}

export function blacklistedEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("⛔ You Are Blacklisted")
    .setDescription("You have been blacklisted from using this bot.")
    .setColor(COLOR.red);
}

// ─── Allowed Guilds ────────────────────────────────────────────────────────────

export function allowedGuildsEmbed(mainGuildId: string): EmbedBuilder {
  const list = listAllowedGuilds();
  const allIds = [mainGuildId, ...list];
  const lines = allIds.map((id, i) => {
    const label = id === mainGuildId ? " ⭐ *(main)*" : "";
    return `\`${i + 1}.\` \`${id}\`${label}`;
  });
  return new EmbedBuilder()
    .setTitle(`🌐 Allowed Servers (${allIds.length})`)
    .setDescription(lines.join("\n"))
    .setColor(COLOR.blurple)
    .setFooter({ text: "Use /enable_server and /disable_server to manage" })
    .setTimestamp();
}

// ─── Auth Guards ───────────────────────────────────────────────────────────────

export function denyEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("❌ Access Denied")
    .setDescription("Only the **server owner** or a designated **owner** can use that command.")
    .setColor(COLOR.red);
}

// ─── Legacy embeds (used by Bot 2, 3, 4 — kept for compatibility) ─────────────

export function stockEmbed(): EmbedBuilder {
  const count = readAuthUsers().length;
  return new EmbedBuilder()
    .setTitle("📦 Stock")
    .setDescription(`Current stock: **${count}** token(s).\n\nPowered by Memberk`)
    .setColor(COLOR.blurple);
}

export function countEmbed(): EmbedBuilder {
  const stored = readStoredTokens().length;
  const stock = readAuthUsers().length;
  return new EmbedBuilder()
    .setTitle("📊 Token Count")
    .setDescription(
      `**${stored}** stored token(s) (individual OAuth authorizations).\n` +
      `**${stock}** in bulk stock.`,
    )
    .setColor(COLOR.blurple)
    .setTimestamp();
}

export function ownersEmbed(guildOwnerId: string, guildId: string): EmbedBuilder {
  const ownerRoles = getGuildOwnerRoles(guildId);
  const lines: string[] = [
    `👑 <@${guildOwnerId}> — **Server Owner** (permanent)`,
    "\n**Global Owners** (hardcoded — full access in every server):",
  ];
  for (const oid of HARDCODED_OWNERS) lines.push(`⭐ <@${oid}>`);
  if (ownerRoles.length) {
    lines.push("\n**Owner Roles** (anyone with these roles gets owner access):");
    for (const rid of ownerRoles) lines.push(`🛡️ <@&${rid}>`);
  } else {
    lines.push("\n*No owner roles configured.*");
  }
  return new EmbedBuilder()
    .setTitle("👑 Owner Access List")
    .setDescription(lines.join("\n"))
    .setColor(COLOR.blurple)
    .setTimestamp()
    .setFooter({
      text: `${HARDCODED_OWNERS.length} global owner(s) • ${ownerRoles.length} owner role(s)`,
    });
}

export function channelLockedEmbed(channelId: string, cmd: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("📌 Wrong Channel")
    .setDescription(
      `The \`${cmd}\` command is locked to <#${channelId}>.\n\nPlease use it there.`,
    )
    .setColor(COLOR.yellow);
}

export function verifyEmbed(imageUrl?: string | null): {
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: "identify guilds.join",
    prompt: "consent",
  });
  const url = `https://discord.com/oauth2/authorize?${params.toString()}`;
  const embed = new EmbedBuilder()
    .setDescription(
      "✅ **Memberk Official Verification** ✅\n\n" +
      "✅ Verify or no restocks! ( Cannot farm members too )",
    )
    .setColor(0x00c8ff);
  if (imageUrl) embed.setImage(imageUrl);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Verify")
      .setStyle(ButtonStyle.Link)
      .setURL(url),
  );
  return { embed, components: [row] };
}

// ─── Invite ────────────────────────────────────────────────────────────────────

export function inviteEmbed(): EmbedBuilder {
  const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands`;
  return new EmbedBuilder()
    .setTitle("🤖 Bot Invite Link")
    .setDescription(
      `[👉 Click here to add the bot to a server](${url})\n\n` +
      `⚠️ The bot automatically **leaves servers after 14 days** (except the main server).`,
    )
    .setColor(COLOR.blurple)
    .setTimestamp();
}
