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
  MAX_ROLES_PER_GUILD,
  SUPER_OWNER_ID,
  getPublicDomain,
  getRedirectUri,
} from "../config.js";
import { readChannelLocks } from "../storage/locks.js";
import { getGuildOwnerRoles } from "../storage/owners.js";
import { getGuildRoleLimits } from "../storage/roles.js";
import { readDailyRestock, readScheduledRestocks } from "../storage/schedules.js";
import { readAuthUsers, readStoredTokens } from "../storage/tokens.js";
import { listAllowedGuilds } from "../storage/allowedGuilds.js";
import { listBlacklisted } from "../storage/blacklist.js";

function now(): Date {
  return new Date();
}

// ─── Help / OAuth ─────────────────────────────────────────────────────────────

export function helpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🤖 Members Bot — All Commands")
    .setColor(COLOR.blurple)
    .setTimestamp(now())
    .addFields(
      {
        name: "🔐 Authentication",
        value:
          "`/get_token` or `!get_token` — Get auth link\n" +
          "`/auth code:CODE` or `!auth CODE` — Authenticate\n" +
          "`/check_tokens` or `!check_tokens` — Validate tokens",
      },
      {
        name: "🚀 Mass Joining",
        value:
          "`/djoin server_id:ID` or `!djoin ID` — Add all users to server\n" +
          "`/servers` or `!servers` — List bot servers\n" +
          "`/server_age` or `!server_age [ID]` — Check server age",
      },
      {
        name: "👥 User Management",
        value:
          "`/count` — Stored token count\n" +
          "`/list_users` — List authenticated users\n" +
          "`/restock` — Add bulk tokens (owners only)\n" +
          "`/add_token` — Authorize one token (owners only)\n" +
          "`/clear_stock` — Remove all stored tokens (owners only)\n" +
          "`/schedule_restock time:1h` — Schedule a restock (owners only)\n" +
          "`/list_schedules` — View pending schedules (owners only)\n" +
          "`/cancel_schedule id:ID` — Cancel a schedule (owners only)\n" +
          "`/set_daily_restock time:14:00` — Daily restock (owners only)\n" +
          "`/cancel_daily_restock` — Cancel daily restock (owners only)\n" +
          "`/daily_restock_status` — Show daily config (owners only)",
      },
      {
        name: "👑 Owner Management",
        value:
          "`/owners` — List all owners\n" +
          "`/control_panel` — Open the interactive owner control panel\n" +
          "`/setowner_role @role` — Grant owner access by role\n" +
          "`/removeowner_role @role` — Revoke owner role\n" +
          "`/listowner_roles` — List all owner roles\n" +
          "`/restart` — Restart bot\n" +
          "`/dashboard` — Get private dashboard link (owners only)",
      },
      {
        name: "🎭 Role Limits",
        value:
          "`/setrole role:@Role limit:N` — Set role djoin limit\n" +
          "`/removerole role:@Role` — Remove role limit\n" +
          "`/listroles` — List all role limits",
      },
      {
        name: "📌 Channel Locks",
        value:
          "`/setchannel type:djoin channel:#ch` — Lock djoin to channel\n" +
          "`/setchannel type:auth channel:#ch` — Lock auth to channel\n" +
          "`/clearchannel type:djoin` — Remove lock\n" +
          "`/listchannels` — Show channel locks",
      },
      {
        name: "📣 Announcements (Gecko)",
        value:
          "`/setup_subscribe` — Post the opt-in subscribe embed\n" +
          "`/announce message:...` — DM subscribers an announcement\n" +
          "`/subscribers` — Count subscribers in this server",
      },
      {
        name: "🔧 Utility",
        value:
          "`/invite` — Bot invite link\n" +
          "`/add` — Add bot embed\n" +
          "`/stock` — Show current token stock\n" +
          "`/status` — Show bot online status & stats\n" +
          "`/cleanup_servers` — Leave all other servers (owners only)\n" +
          "`/help` — Show this message",
      },
      {
        name: "⚠️ Notes",
        value:
          "• Bot auto-leaves servers after 14 days\n" +
          "• Both `/` slash commands and `!` prefix commands work\n" +
          "• Role-limit / channel commands: owner only",
      },
    );
}

export function getTokenEmbed(userId: string): EmbedBuilder {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: "identify guilds.join",
    prompt: "consent",
    state: userId,
  });
  const url = `https://discord.com/oauth2/authorize?${params.toString()}`;
  return new EmbedBuilder()
    .setTitle("🔐 Authentication Required")
    .setDescription("Click the link below to authorize your account.")
    .setColor(COLOR.blurple)
    .setTimestamp(now())
    .addFields(
      {
        name: "🚨 Important",
        value: "Codes expire in **10 minutes** — act fast!",
      },
      {
        name: "🔗 Auth Link",
        value: `[👉 Click Here to Authenticate 👈](${url})`,
      },
      {
        name: "📝 Steps",
        value:
          "1. Click the link above\n" +
          "2. Click **Authorize** on Discord's page\n" +
          "3. You'll land on a page showing your **code** — tap **Copy /auth Command**\n" +
          "4. Come back here and paste it: `/auth code:YOUR_CODE`",
      },
    );
}

export function authSuccessDmEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("✅ You're Authorized!")
    .setDescription(
      "You have been **successfully authorized**.\n\n" +
        "🛡️ **Only use `/djoin` in Memberty.** Any other server " +
        "claiming to use this bot is a **scam** — do not trust it.\n\n" +
        "📦 `/djoin` only works **when there is stock available**. " +
        "If stock is empty, wait for a restock before trying.",
    )
    .setColor(COLOR.green)
    .setTimestamp(now())
    .setFooter({ text: "Memberty • Authorization confirmed" });
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
        : "There are **no tokens** in stock.\n\nUse `/restock` to add tokens.",
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

export function addEmbed(client: Client): {
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
} {
  const invite =
    `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}` +
    `&permissions=8&scope=bot%20applications.commands`;
  const e = new EmbedBuilder()
    .setTitle("➕ Add Members Bot to Your Server")
    .setDescription(
      "Click the button below to invite **Members Bot** to your Discord server.\n\n" +
        "**What this bot does:**\n" +
        "• Backup & restore server members via OAuth2\n" +
        "• Mass-join authenticated users into any server\n" +
        "• Auto token refresh & validation\n" +
        "• Both `/` slash commands and `!` prefix commands",
    )
    .setColor(COLOR.blurple)
    .setTimestamp(now())
    .addFields(
      {
        name: "⚡ Permissions",
        value: "Administrator (required for guild member management)",
      },
      {
        name: "📋 Commands",
        value: "22+ commands — slash & prefix",
        inline: true,
      },
      {
        name: "🔒 OAuth2 Scopes",
        value: "`bot` + `applications.commands`",
        inline: true,
      },
    )
    .setFooter({ text: "Members Bot • Invite & start collecting tokens right away" });
  if (client.user) {
    const url = client.user.displayAvatarURL();
    if (url) e.setThumbnail(url);
  }
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("➕ Add to Server")
      .setStyle(ButtonStyle.Link)
      .setURL(invite),
    new ButtonBuilder()
      .setLabel("📖 How to Use")
      .setStyle(ButtonStyle.Link)
      .setURL("https://discord.com/channels/@me"),
  );
  return { embed: e, components: [row] };
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

export function redirectUrlEmbed(): EmbedBuilder {
  const redirect = getRedirectUri();
  const domain = getPublicDomain() ?? "(none detected)";
  return new EmbedBuilder()
    .setTitle("🔗 OAuth Redirect URL")
    .setDescription(
      "Add the URL below as a **Redirect** in your Discord application " +
        "(Developer Portal → OAuth2 → Redirects). After saving, the " +
        "`/get_token` flow will work without publishing the app.",
    )
    .setColor(COLOR.blurple)
    .setTimestamp(now())
    .addFields(
      { name: "📋 Redirect URI", value: `\`${redirect}\`` },
      { name: "🌐 Public domain", value: `\`${domain}\``, inline: true },
      {
        name: "ℹ️ Super-owner",
        value: `<@${SUPER_OWNER_ID}>`,
        inline: true,
      },
    )
    .setFooter({
      text: "This URL is auto-derived from REPLIT_DEV_DOMAIN — no publish needed.",
    });
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
        "1. Run `/get_token` to get your auth link\n" +
        "2. Click the link and authorize the app\n" +
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
      "Memberty bot commands **only work in the official Memberty server**.\n\n" +
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
