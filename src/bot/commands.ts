import {
  ApplicationCommandOptionType,
  ChannelType,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type RESTPostAPIApplicationCommandsJSONBody,
  type Attachment,
  Routes,
  REST,
  type Client,
} from "discord.js";
import * as crypto from "node:crypto";

import {
  BOT_TOKEN,
  CLIENT_ID,
  MAIN_GUILD_ID,
  MAX_ROLES_PER_GUILD,
  PREFIX,
  SUPER_OWNER_ID,
} from "../config.js";
import {
  addAllowedGuild,
  isAllowedGuild,
  removeAllowedGuild,
} from "../storage/allowedGuilds.js";
import {
  addBlacklisted,
  isBlacklisted,
  removeBlacklisted,
} from "../storage/blacklist.js";
import {
  clearAutoPing,
  getAutoPing,
  setAutoPing,
} from "../storage/autoping.js";
import { sendAutoPing } from "./autoping.js";
import {
  cleanIncomingTokens,
  clearIncomingTokens,
  ensureIncomingTokensFile,
  INCOMING_TOKENS_FILE,
  readIncomingTokensRaw,
} from "../storage/bulkTokenFile.js";
import { exchangeCode } from "../oauth.js";
import {
  saveUserAuth,
  appendAuthUser,
} from "../storage/tokens.js";
import {
  addScheduledRestock,
  readDailyRestock,
  removeScheduledRestock,
  writeDailyRestock,
} from "../storage/schedules.js";
import {
  clearChannelLock,
  setChannelLock,
} from "../storage/locks.js";
import {
  addGuildOwnerRole,
  getGuildOwnerRoles,
  removeGuildOwnerRole,
} from "../storage/owners.js";
import {
  getGuildRoleLimits,
  removeGuildRoleLimit,
  setGuildRoleLimit,
} from "../storage/roles.js";
import { dbCount, dbList } from "../storage/subscribers.js";

import * as E from "./embeds.js";
import { isAuthorizedMember } from "./permissions.js";
import {
  clearStock,
  doAddToken,
  doCheckTokens,
  doCleanupServers,
  doMassJoin,
  doRestock,
} from "./restock.js";
import { controlPanelComponents, controlPanelEmbed } from "./controlPanel.js";
import { subscribeComponents } from "./subscribeView.js";
import type { BotState } from "./client.js";

const O = ApplicationCommandOptionType;

export function buildSlashDefinitions(): RESTPostAPIApplicationCommandsJSONBody[] {
  return [
    { name: "help", description: "Show all commands", type: 1 },
    { name: "get_token", description: "Get OAuth auth link", type: 1 },
    {
      name: "auth",
      description: "Authenticate with code from OAuth",
      type: 1,
      options: [
        { name: "code", description: "OAuth code from auth link", type: O.String, required: true },
      ],
    },
    { name: "count", description: "Stored token count", type: 1 },
    { name: "list_users", description: "List authenticated users", type: 1 },
    { name: "check_tokens", description: "Validate stored tokens", type: 1 },
    { name: "stock", description: "Show current token stock", type: 1 },
    { name: "status", description: "Bot status & stats", type: 1 },
    { name: "servers", description: "List bot servers", type: 1 },
    {
      name: "server_age",
      description: "Show server age",
      type: 1,
      options: [
        { name: "server_id", description: "Server ID", type: O.String, required: false },
      ],
    },
    { name: "invite", description: "Bot invite link", type: 1 },
    { name: "add", description: "Add bot embed", type: 1 },
    {
      name: "djoin",
      description: "Mass-join all stored users into a server (owners only)",
      type: 1,
      options: [
        { name: "server_id", description: "Target server ID", type: O.String, required: true },
      ],
    },
    {
      name: "restock",
      description: "Add bulk tokens (owners only)",
      type: 1,
      options: [
        { name: "file", description: ".txt file with tokens", type: O.Attachment, required: false },
        { name: "tokens", description: "Pasted token list", type: O.String, required: false },
      ],
    },
    {
      name: "add_token",
      description: "Authorize one token (owners only)",
      type: 1,
      options: [
        { name: "token_line", description: "userId,accessToken,refreshToken", type: O.String, required: true },
      ],
    },
    { name: "clear_stock", description: "Remove all stored tokens (owners only)", type: 1 },
    { name: "cleanup_servers", description: "Leave all other servers (owners only)", type: 1 },
    { name: "control_panel", description: "Open the interactive owner control panel", type: 1 },
    { name: "owners", description: "List all owners", type: 1 },
    {
      name: "setowner_role",
      description: "Grant owner access by role (owners only)",
      type: 1,
      options: [
        { name: "role", description: "Role to grant owner access", type: O.Role, required: true },
      ],
    },
    {
      name: "removeowner_role",
      description: "Revoke owner role (owners only)",
      type: 1,
      options: [
        { name: "role", description: "Role to revoke", type: O.Role, required: true },
      ],
    },
    { name: "listowner_roles", description: "List all owner roles", type: 1 },
    { name: "restart", description: "Restart bot (owners only)", type: 1 },
    { name: "dashboard", description: "Get private dashboard link (owners only)", type: 1 },
    {
      name: "setrole",
      description: "Set role djoin limit (owners only)",
      type: 1,
      options: [
        { name: "role", description: "Role", type: O.Role, required: true },
        { name: "limit", description: "Max members", type: O.Integer, required: true, min_value: 0 },
      ],
    },
    {
      name: "removerole",
      description: "Remove role limit (owners only)",
      type: 1,
      options: [{ name: "role", description: "Role", type: O.Role, required: true }],
    },
    { name: "listroles", description: "List all role limits", type: 1 },
    {
      name: "setchannel",
      description: "Lock a command type to a channel (owners only)",
      type: 1,
      options: [
        {
          name: "type",
          description: "Command type",
          type: O.String,
          required: true,
          choices: [
            { name: "djoin", value: "djoin" },
            { name: "auth", value: "auth" },
          ],
        },
        {
          name: "channel",
          description: "Channel",
          type: O.Channel,
          required: true,
          channel_types: [ChannelType.GuildText],
        },
      ],
    },
    {
      name: "clearchannel",
      description: "Clear a channel lock (owners only)",
      type: 1,
      options: [
        {
          name: "type",
          description: "Command type",
          type: O.String,
          required: true,
          choices: [
            { name: "djoin", value: "djoin" },
            { name: "auth", value: "auth" },
          ],
        },
      ],
    },
    { name: "listchannels", description: "Show channel locks", type: 1 },
    {
      name: "schedule_restock",
      description: "Schedule a restock (owners only)",
      type: 1,
      options: [
        { name: "time", description: "e.g. 1h, 30m, 2h30m", type: O.String, required: true },
        { name: "file", description: ".txt file with tokens", type: O.Attachment, required: false },
        { name: "tokens", description: "Pasted token list", type: O.String, required: false },
      ],
    },
    { name: "list_schedules", description: "Show pending scheduled restocks (owners only)", type: 1 },
    {
      name: "cancel_schedule",
      description: "Cancel a scheduled restock (owners only)",
      type: 1,
      options: [{ name: "id", description: "Schedule ID", type: O.String, required: true }],
    },
    {
      name: "set_daily_restock",
      description: "Configure a daily restock (owners only)",
      type: 1,
      options: [
        { name: "time", description: "HH:MM (24h, MST)", type: O.String, required: true },
        { name: "file", description: ".txt file with tokens", type: O.Attachment, required: false },
        { name: "tokens", description: "Pasted token list", type: O.String, required: false },
      ],
    },
    { name: "cancel_daily_restock", description: "Cancel daily restock (owners only)", type: 1 },
    { name: "daily_restock_status", description: "Show daily restock config (owners only)", type: 1 },
    { name: "setup_subscribe", description: "Post the opt-in subscribe embed (owners only)", type: 1 },
    {
      name: "announce",
      description: "DM all subscribers an announcement (owners only)",
      type: 1,
      options: [
        { name: "message", description: "Announcement message", type: O.String, required: true },
      ],
    },
    { name: "subscribers", description: "Count subscribers in this server", type: 1 },
    { name: "live_stock", description: "Post a live-updating stock embed (owners only)", type: 1 },
    { name: "live_status", description: "Post a live-updating status embed (owners only)", type: 1 },

    // ─── Super-owner / private commands ──────────────────────────────────
    {
      name: "blacklist",
      description: "Blacklist a user from the bot (super-owner only)",
      type: 1,
      options: [
        { name: "user_id", description: "User ID to blacklist", type: O.String, required: true },
      ],
    },
    {
      name: "unblacklist",
      description: "Remove a user from the blacklist (super-owner only)",
      type: 1,
      options: [
        { name: "user_id", description: "User ID to unblacklist", type: O.String, required: true },
      ],
    },
    {
      name: "blacklist_list",
      description: "Show all blacklisted users (super-owner only)",
      type: 1,
    },
    {
      name: "enable_server",
      description: "Allow another server to use this bot (super-owner only)",
      type: 1,
      options: [
        { name: "server_id", description: "Server (guild) ID to enable", type: O.String, required: true },
      ],
    },
    {
      name: "disable_server",
      description: "Disable an extra server (super-owner only)",
      type: 1,
      options: [
        { name: "server_id", description: "Server (guild) ID to disable", type: O.String, required: true },
      ],
    },
    {
      name: "list_allowed_servers",
      description: "List servers allowed to use this bot (super-owner only)",
      type: 1,
    },
    {
      name: "autoping_set",
      description:
        "Auto-ping new members in a channel when they join (no per-server limit)",
      type: 1,
      options: [
        {
          name: "channel",
          description: "Channel to send the welcome ping in",
          type: O.Channel,
          required: true,
          channel_types: [
            ChannelType.GuildText,
            ChannelType.GuildAnnouncement,
            ChannelType.PublicThread,
            ChannelType.PrivateThread,
            ChannelType.AnnouncementThread,
          ],
        },
        {
          name: "message",
          description:
            "Template. Placeholders: {user} {username} {server} {count}",
          type: O.String,
          required: false,
        },
        {
          name: "role",
          description: "Optional extra role to ping along with the new member",
          type: O.Role,
          required: false,
        },
      ],
    },
    {
      name: "autoping_clear",
      description: "Disable auto-ping in this server",
      type: 1,
    },
    {
      name: "autoping_status",
      description: "Show the current auto-ping configuration for this server",
      type: 1,
    },
    {
      name: "autoping_test",
      description: "Send a test auto-ping for yourself",
      type: 1,
    },
    {
      name: "load_tokens",
      description:
        "Load tokens from artifacts/data/incoming_tokens.txt into bulk stock",
      type: 1,
      options: [
        {
          name: "keep_file",
          description:
            "If true, leaves the file as-is after loading (default: clears it)",
          type: O.Boolean,
          required: false,
        },
      ],
    },
    {
      name: "tokens_file_path",
      description:
        "Show the path to the incoming-tokens file and create it if missing",
      type: 1,
    },
  ];
}

export async function registerCommandsForGuild(guildId: string): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);
  const body = buildSlashDefinitions();
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body });
    console.log(`[commands] registered ${body.length} commands for guild ${guildId}`);
  } catch (e) {
    console.error(`[commands] failed to register for guild ${guildId}`, e);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ownerGuard(
  i: ChatInputCommandInteraction,
): Promise<boolean> {
  if (!i.guild) {
    await i.reply({ embeds: [E.denyEmbed()], ephemeral: true });
    return false;
  }
  const member = await i.guild.members.fetch(i.user.id).catch(() => null);
  if (!isAuthorizedMember(i.guild.ownerId, i.guild.id, i.user.id, member)) {
    await i.reply({ embeds: [E.denyEmbed()], ephemeral: true });
    return false;
  }
  return true;
}

async function realOwnerGuard(
  i: ChatInputCommandInteraction,
): Promise<boolean> {
  if (!i.guild) {
    await i.reply({ embeds: [E.denyRealOwnerEmbed()], ephemeral: true });
    return false;
  }
  if (
    i.user.id !== i.guild.ownerId &&
    !["1411750730380869828", "1486174745333465179"].includes(i.user.id)
  ) {
    await i.reply({ embeds: [E.denyRealOwnerEmbed()], ephemeral: true });
    return false;
  }
  return true;
}

async function wrongGuildGuard(
  i: ChatInputCommandInteraction,
): Promise<boolean> {
  if (
    !i.guildId ||
    (i.guildId !== MAIN_GUILD_ID && !isAllowedGuild(i.guildId))
  ) {
    await i.reply({ embeds: [E.wrongGuildEmbed()], ephemeral: true });
    return false;
  }
  return true;
}

async function superOwnerGuard(
  i: ChatInputCommandInteraction,
): Promise<boolean> {
  if (i.user.id !== SUPER_OWNER_ID) {
    await i.reply({ embeds: [E.denySuperOwnerEmbed()], ephemeral: true });
    return false;
  }
  return true;
}

async function blacklistGuard(
  i: ChatInputCommandInteraction,
): Promise<boolean> {
  if (isBlacklisted(i.user.id)) {
    await i.reply({ embeds: [E.blacklistedEmbed()], ephemeral: true });
    return false;
  }
  return true;
}

async function readAttachment(att: Attachment | null): Promise<string | null> {
  if (!att) return null;
  try {
    const r = await fetch(att.url);
    return await r.text();
  } catch {
    return null;
  }
}

function parseDurationMs(s: string): number | null {
  const m = s.toLowerCase().match(/^(?:(\d+)h)?(?:(\d+)m)?$/);
  if (!m || (!m[1] && !m[2])) return null;
  const h = m[1] ? parseInt(m[1], 10) : 0;
  const min = m[2] ? parseInt(m[2], 10) : 0;
  return (h * 60 + min) * 60 * 1000;
}

function normalizeHHMM(s: string): string | null {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// ─── Slash command dispatch ───────────────────────────────────────────────────

export async function handleSlash(
  i: ChatInputCommandInteraction,
  state: BotState,
  client: Client,
): Promise<void> {
  if (!(await blacklistGuard(i))) return;
  if (!(await wrongGuildGuard(i))) return;
  const cmd = i.commandName;

  switch (cmd) {
    case "help":
      await i.reply({ embeds: [E.helpEmbed()] });
      return;
    case "get_token":
      await i.reply({ embeds: [E.getTokenEmbed(i.user.id)], ephemeral: true });
      return;
    case "auth": {
      const code = i.options.getString("code", true);
      await i.deferReply({ ephemeral: true });
      const res = await exchangeCode(code.trim());
      if (!res.ok) {
        await i.followUp({ content: `❌ Auth failed: ${res.error}`, ephemeral: true });
        return;
      }
      saveUserAuth(i.user.id, res.data.access_token, res.data.refresh_token);
      // DM them success
      i.user.send({ embeds: [E.authSuccessDmEmbed()] }).catch(() => {});
      await i.followUp({
        embeds: [
          E.helpEmbed().setTitle("✅ Authentication Successful").setDescription(`<@${i.user.id}> has been authenticated.`),
        ],
        ephemeral: true,
      });
      return;
    }
    case "count":
      await i.reply({ embeds: [E.countEmbed()] });
      return;
    case "list_users": {
      const { embed } = E.listUsersEmbed();
      await i.reply({ embeds: [embed] });
      return;
    }
    case "check_tokens": {
      if (!(await ownerGuard(i))) return;
      await i.deferReply({ ephemeral: true });
      const e = await doCheckTokens();
      await i.followUp({ embeds: [e], ephemeral: true });
      return;
    }
    case "stock":
      await i.reply({ embeds: [E.stockEmbed()] });
      return;
    case "status":
      await i.reply({ embeds: [E.statusEmbed(client, state.botStartTime)] });
      return;
    case "servers":
      await i.reply({ embeds: [E.serversEmbed(client, state.serverJoinTimes)] });
      return;
    case "server_age": {
      const sid = i.options.getString("server_id");
      await i.reply({
        embeds: [E.serverAgeEmbed(sid, client, state.serverJoinTimes)],
      });
      return;
    }
    case "invite":
      await i.reply({ embeds: [E.inviteEmbed()] });
      return;
    case "add": {
      const { embed, components } = E.addEmbed(client);
      await i.reply({ embeds: [embed], components });
      return;
    }
    case "djoin": {
      const sid = i.options.getString("server_id", true);
      // channel lock check
      const lock = (await import("../storage/locks.js")).checkChannelLock(
        i.guildId!,
        "djoin",
        i.channelId!,
      );
      if (lock) {
        await i.reply({
          embeds: [E.channelLockedEmbed(lock, "djoin")],
          ephemeral: true,
        });
        return;
      }
      // need to be authorized (stored token)
      const stored = (await import("../storage/tokens.js")).findStoredToken(i.user.id);
      if (!stored && !isAuthorizedMember(i.guild!.ownerId, i.guild!.id, i.user.id, await i.guild!.members.fetch(i.user.id).catch(() => null))) {
        await i.reply({ embeds: [E.notAuthedEmbed()], ephemeral: true });
        return;
      }
      await i.deferReply();
      const e = await doMassJoin(sid, client, async (txt) => {
        try {
          await i.editReply({ content: txt });
        } catch {
          /* noop */
        }
      });
      if (e) await i.editReply({ content: "", embeds: [e] });
      return;
    }
    case "restock": {
      if (!(await ownerGuard(i))) return;
      const file = i.options.getAttachment("file");
      const tokens = i.options.getString("tokens");
      if (!file && !tokens) {
        await i.reply({ embeds: [E.noTokensEmbed()], ephemeral: true });
        return;
      }
      await i.deferReply({ ephemeral: true });
      let raw = tokens ?? "";
      if (file) {
        const t = await readAttachment(file);
        if (t === null) {
          await i.followUp({ content: "❌ Could not read attachment.", ephemeral: true });
          return;
        }
        raw = t;
      }
      const e = await doRestock(raw);
      await i.followUp({ embeds: [e], ephemeral: true });
      return;
    }
    case "add_token": {
      if (!(await ownerGuard(i))) return;
      const line = i.options.getString("token_line", true);
      await i.deferReply({ ephemeral: true });
      const e = await doAddToken(line);
      await i.followUp({ embeds: [e], ephemeral: true });
      return;
    }
    case "clear_stock":
      if (!(await ownerGuard(i))) return;
      clearStock();
      await i.reply({ content: "🧹 Stock cleared.", ephemeral: true });
      return;
    case "cleanup_servers": {
      if (!(await ownerGuard(i))) return;
      await i.deferReply({ ephemeral: true });
      const e = await doCleanupServers(client, i.guild!.id);
      await i.followUp({ embeds: [e], ephemeral: true });
      return;
    }
    case "control_panel": {
      if (!(await ownerGuard(i))) return;
      await i.reply({
        embeds: [controlPanelEmbed()],
        components: controlPanelComponents(),
      });
      return;
    }
    case "owners":
      await i.reply({ embeds: [E.ownersEmbed(i.guild!.ownerId, i.guildId!)] });
      return;
    case "setowner_role": {
      if (!(await realOwnerGuard(i))) return;
      const role = i.options.getRole("role", true);
      const ok = addGuildOwnerRole(i.guildId!, role.id);
      await i.reply({
        content: ok
          ? `✅ <@&${role.id}> can now use owner-only commands.`
          : `ℹ️ <@&${role.id}> already has owner access.`,
        ephemeral: true,
      });
      return;
    }
    case "removeowner_role": {
      if (!(await realOwnerGuard(i))) return;
      const role = i.options.getRole("role", true);
      const ok = removeGuildOwnerRole(i.guildId!, role.id);
      await i.reply({
        content: ok
          ? `✅ Removed owner access for <@&${role.id}>.`
          : `ℹ️ <@&${role.id}> didn't have owner access.`,
        ephemeral: true,
      });
      return;
    }
    case "listowner_roles":
      await i.reply({ embeds: [E.ownerRolesEmbed(i.guildId!)], ephemeral: true });
      return;
    case "restart":
      if (!(await ownerGuard(i))) return;
      await i.reply({ content: "🔄 Restarting…", ephemeral: true });
      setTimeout(() => process.exit(0), 500);
      return;
    case "dashboard":
      if (!(await ownerGuard(i))) return;
      await i.reply({ embeds: [E.dashboardEmbed()], ephemeral: true });
      return;
    case "setrole": {
      if (!(await ownerGuard(i))) return;
      const role = i.options.getRole("role", true);
      const limit = i.options.getInteger("limit", true);
      const existing = getGuildRoleLimits(i.guildId!);
      if (!(role.id in existing) && Object.keys(existing).length >= MAX_ROLES_PER_GUILD) {
        await i.reply({
          content: `❌ Limit reached (${MAX_ROLES_PER_GUILD} roles max).`,
          ephemeral: true,
        });
        return;
      }
      setGuildRoleLimit(i.guildId!, role.id, limit);
      await i.reply({
        content: `✅ <@&${role.id}> djoin limit set to **${limit}**.`,
        ephemeral: true,
      });
      return;
    }
    case "removerole": {
      if (!(await ownerGuard(i))) return;
      const role = i.options.getRole("role", true);
      const removed = removeGuildRoleLimit(i.guildId!, role.id);
      await i.reply({
        content: removed
          ? `✅ Removed limit for <@&${role.id}>.`
          : `ℹ️ <@&${role.id}> had no limit.`,
        ephemeral: true,
      });
      return;
    }
    case "listroles":
      await i.reply({ embeds: [E.roleLimitsEmbed(i.guildId!)], ephemeral: true });
      return;
    case "setchannel": {
      if (!(await ownerGuard(i))) return;
      const type = i.options.getString("type", true) as "djoin" | "auth";
      const channel = i.options.getChannel("channel", true);
      setChannelLock(i.guildId!, type, channel.id);
      await i.reply({
        content: `✅ \`${type}\` is now locked to <#${channel.id}>.`,
        ephemeral: true,
      });
      return;
    }
    case "clearchannel": {
      if (!(await ownerGuard(i))) return;
      const type = i.options.getString("type", true) as "djoin" | "auth";
      const cleared = clearChannelLock(i.guildId!, type);
      await i.reply({
        content: cleared ? "✅ Channel lock cleared." : "ℹ️ That type was not locked.",
        ephemeral: true,
      });
      return;
    }
    case "listchannels":
      await i.reply({ embeds: [E.channelLocksEmbed(i.guildId!)], ephemeral: true });
      return;
    case "schedule_restock": {
      if (!(await ownerGuard(i))) return;
      const time = i.options.getString("time", true);
      const ms = parseDurationMs(time);
      if (ms === null) {
        await i.reply({ content: "❌ Invalid time. Try `1h`, `30m`, `2h30m`.", ephemeral: true });
        return;
      }
      const file = i.options.getAttachment("file");
      const tokens = i.options.getString("tokens");
      if (!file && !tokens) {
        await i.reply({ embeds: [E.noTokensEmbed()], ephemeral: true });
        return;
      }
      await i.deferReply({ ephemeral: true });
      let raw = tokens ?? "";
      if (file) {
        const t = await readAttachment(file);
        if (t === null) {
          await i.followUp({ content: "❌ Could not read attachment.", ephemeral: true });
          return;
        }
        raw = t;
      }
      const sid = crypto.randomBytes(4).toString("hex");
      const runAt = Date.now() + ms;
      addScheduledRestock({
        id: sid,
        runAt,
        rawTokens: raw,
        channelId: i.channelId!,
        createdBy: i.user.id,
      });
      await i.followUp({
        embeds: [
          E.helpEmbed()
            .setTitle("✅ Restock Scheduled")
            .setDescription(
              `Schedule \`${sid}\` will run in **${time}** (<t:${Math.floor(runAt / 1000)}:R>) in this channel.`,
            ),
        ],
        ephemeral: true,
      });
      return;
    }
    case "list_schedules":
      if (!(await ownerGuard(i))) return;
      await i.reply({ embeds: [E.listSchedulesEmbed()], ephemeral: true });
      return;
    case "cancel_schedule": {
      if (!(await ownerGuard(i))) return;
      const id = i.options.getString("id", true);
      const removed = removeScheduledRestock(id);
      await i.reply({
        content: removed ? `✅ Schedule \`${id}\` cancelled.` : `ℹ️ No pending schedule with id \`${id}\`.`,
        ephemeral: true,
      });
      return;
    }
    case "set_daily_restock": {
      if (!(await ownerGuard(i))) return;
      const time = i.options.getString("time", true);
      const norm = normalizeHHMM(time);
      if (!norm) {
        await i.reply({ content: "❌ Invalid time. Use `HH:MM` (24h, MST).", ephemeral: true });
        return;
      }
      const file = i.options.getAttachment("file");
      const tokens = i.options.getString("tokens");
      if (!file && !tokens) {
        await i.reply({ embeds: [E.noTokensEmbed()], ephemeral: true });
        return;
      }
      await i.deferReply({ ephemeral: true });
      let raw = tokens ?? "";
      if (file) {
        const t = await readAttachment(file);
        if (t === null) {
          await i.followUp({ content: "❌ Could not read attachment.", ephemeral: true });
          return;
        }
        raw = t;
      }
      writeDailyRestock({
        time: norm,
        rawTokens: raw,
        channelId: i.channelId!,
        createdBy: i.user.id,
        lastRanDate: null,
      });
      const tokenCount = raw.split(/\r?\n/).filter((l) => l.trim()).length;
      await i.followUp({
        embeds: [
          E.helpEmbed()
            .setTitle("✅ Daily Restock Configured")
            .setDescription(
              `Will run every day at **${norm} MST** with **${tokenCount}** tokens.`,
            ),
        ],
        ephemeral: true,
      });
      return;
    }
    case "cancel_daily_restock":
      if (!(await ownerGuard(i))) return;
      writeDailyRestock(null);
      await i.reply({ content: "✅ Daily restock cancelled.", ephemeral: true });
      return;
    case "daily_restock_status":
      if (!(await ownerGuard(i))) return;
      await i.reply({ embeds: [E.dailyRestockStatusEmbed()], ephemeral: true });
      return;
    case "setup_subscribe": {
      if (!(await ownerGuard(i))) return;
      if (!i.channel || !i.channel.isTextBased() || !("send" in i.channel)) {
        await i.reply({ content: "❌ Cannot post here.", ephemeral: true });
        return;
      }
      await i.channel.send({
        embeds: [E.subscribePanelEmbed(i.guild!.name)],
        components: subscribeComponents(),
      });
      await i.reply({ content: "✅ Subscribe panel posted.", ephemeral: true });
      return;
    }
    case "announce": {
      if (!(await ownerGuard(i))) return;
      const message = i.options.getString("message", true);
      await i.deferReply({ ephemeral: true });
      const subs = dbList(i.guildId!);
      if (subs.length === 0) {
        await i.followUp({ content: "ℹ️ No subscribers yet.", ephemeral: true });
        return;
      }
      const embed = E.announcementDmEmbed(i.guild!.name, message);
      let sent = 0,
        failed = 0;
      for (const uid of subs) {
        try {
          const u = client.users.cache.get(uid) ?? (await client.users.fetch(uid));
          await u.send({ embeds: [embed] });
          sent++;
        } catch {
          failed++;
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      await i.followUp({
        content: `✅ Sent to **${sent}** subscriber(s). Failed: **${failed}**.`,
        ephemeral: true,
      });
      return;
    }
    case "subscribers": {
      const n = dbCount(i.guildId!);
      await i.reply({ content: `📣 **${n}** subscriber(s) in this server.`, ephemeral: true });
      return;
    }
    case "live_stock": {
      if (!(await ownerGuard(i))) return;
      if (!i.channel || !("send" in i.channel)) {
        await i.reply({ content: "❌ Cannot post here.", ephemeral: true });
        return;
      }
      const msg = await i.channel.send({ embeds: [E.stockEmbed()] });
      state.liveMessages.set("stock", { channelId: msg.channelId, messageId: msg.id });
      await i.reply({
        content: "✅ Live stock embed posted (refreshes every 30s).",
        ephemeral: true,
      });
      return;
    }
    case "live_status": {
      if (!(await ownerGuard(i))) return;
      if (!i.channel || !("send" in i.channel)) {
        await i.reply({ content: "❌ Cannot post here.", ephemeral: true });
        return;
      }
      const msg = await i.channel.send({
        embeds: [E.statusEmbed(client, state.botStartTime)],
      });
      state.liveMessages.set("status", { channelId: msg.channelId, messageId: msg.id });
      await i.reply({
        content: "✅ Live status embed posted (refreshes every 30s).",
        ephemeral: true,
      });
      return;
    }

    // ─── Super-owner / private commands ──────────────────────────────────
    case "blacklist": {
      if (!(await superOwnerGuard(i))) return;
      const uid = i.options.getString("user_id", true).trim();
      if (!/^\d{5,25}$/.test(uid)) {
        await i.reply({ content: "❌ That doesn't look like a Discord user ID.", ephemeral: true });
        return;
      }
      if (uid === SUPER_OWNER_ID) {
        await i.reply({ content: "❌ You can't blacklist yourself.", ephemeral: true });
        return;
      }
      const added = addBlacklisted(uid);
      await i.reply({
        content: added
          ? `⛔ <@${uid}> (\`${uid}\`) has been **blacklisted**.`
          : `ℹ️ <@${uid}> is already blacklisted.`,
        ephemeral: true,
      });
      return;
    }
    case "unblacklist": {
      if (!(await superOwnerGuard(i))) return;
      const uid = i.options.getString("user_id", true).trim();
      const removed = removeBlacklisted(uid);
      await i.reply({
        content: removed
          ? `✅ <@${uid}> (\`${uid}\`) has been **unblacklisted**.`
          : `ℹ️ <@${uid}> was not on the blacklist.`,
        ephemeral: true,
      });
      return;
    }
    case "blacklist_list": {
      if (!(await superOwnerGuard(i))) return;
      await i.reply({ embeds: [E.blacklistListEmbed()], ephemeral: true });
      return;
    }
    case "enable_server": {
      if (!(await superOwnerGuard(i))) return;
      const sid = i.options.getString("server_id", true).trim();
      if (!/^\d{5,25}$/.test(sid)) {
        await i.reply({ content: "❌ That doesn't look like a Discord server ID.", ephemeral: true });
        return;
      }
      if (sid === MAIN_GUILD_ID) {
        await i.reply({ content: "ℹ️ The main server is always allowed.", ephemeral: true });
        return;
      }
      const added = addAllowedGuild(sid);
      // Try to register slash commands in the new server (if bot is in it)
      let registered = false;
      try {
        if (client.guilds.cache.has(sid)) {
          await registerCommandsForGuild(sid);
          registered = true;
        }
      } catch (e) {
        console.error("[enable_server] failed to register commands", e);
      }
      const note = registered
        ? "Slash commands have been registered in that server."
        : "The bot isn't in that server yet — invite it, then commands will register automatically.";
      await i.reply({
        content: added
          ? `✅ Server \`${sid}\` is now **allowed** to use this bot.\n${note}`
          : `ℹ️ Server \`${sid}\` was already allowed.\n${note}`,
        ephemeral: true,
      });
      return;
    }
    case "disable_server": {
      if (!(await superOwnerGuard(i))) return;
      const sid = i.options.getString("server_id", true).trim();
      if (sid === MAIN_GUILD_ID) {
        await i.reply({ content: "❌ You can't disable the main server.", ephemeral: true });
        return;
      }
      const removed = removeAllowedGuild(sid);
      await i.reply({
        content: removed
          ? `✅ Server \`${sid}\` is no longer allowed to use this bot.`
          : `ℹ️ Server \`${sid}\` was not in the allowed list.`,
        ephemeral: true,
      });
      return;
    }
    case "list_allowed_servers": {
      if (!(await superOwnerGuard(i))) return;
      await i.reply({
        embeds: [E.allowedGuildsEmbed(MAIN_GUILD_ID)],
        ephemeral: true,
      });
      return;
    }
    case "autoping_set": {
      if (!(await ownerGuard(i))) return;
      const channel = i.options.getChannel("channel", true);
      const messageOpt = i.options.getString("message");
      const role = i.options.getRole("role");
      const existing = getAutoPing(i.guildId!);
      const message =
        messageOpt?.trim() ||
        existing?.message ||
        "👋 Welcome {user} to **{server}**! You're member #{count}.";

      setAutoPing(i.guildId!, {
        channelId: channel.id,
        message,
        mentionRoleId: role?.id ?? null,
      });

      await i.reply({
        content:
          `✅ Auto-ping enabled in <#${channel.id}>.\n` +
          (role ? `Pinging role: <@&${role.id}>\n` : "") +
          `Message: \`${message}\`\n\n` +
          `Use \`/autoping_test\` to preview it.`,
        ephemeral: true,
        allowedMentions: { parse: [] },
      });
      return;
    }
    case "autoping_clear": {
      if (!(await ownerGuard(i))) return;
      const cleared = clearAutoPing(i.guildId!);
      await i.reply({
        content: cleared
          ? "✅ Auto-ping disabled for this server."
          : "ℹ️ Auto-ping wasn't set up here.",
        ephemeral: true,
      });
      return;
    }
    case "autoping_status": {
      if (!(await ownerGuard(i))) return;
      await i.reply({
        embeds: [E.autoPingStatusEmbed(i.guildId!)],
        ephemeral: true,
      });
      return;
    }
    case "load_tokens": {
      if (!(await ownerGuard(i))) return;
      ensureIncomingTokensFile();
      const raw = readIncomingTokensRaw();
      const { cleaned, lineCount } = cleanIncomingTokens(raw);
      if (lineCount === 0) {
        await i.reply({
          content:
            `📄 The incoming-tokens file is empty.\n` +
            `Path: \`${INCOMING_TOKENS_FILE}\`\n` +
            "Drop tokens in (one per line: `userId,accessToken,refreshToken`) and run this again.",
          ephemeral: true,
        });
        return;
      }
      await i.deferReply({ ephemeral: true });
      const embed = await doRestock(cleaned);
      const keepFile = i.options.getBoolean("keep_file") ?? false;
      if (!keepFile) clearIncomingTokens();
      await i.followUp({
        embeds: [embed],
        content: keepFile
          ? `📄 Read **${lineCount}** line(s) from file (file kept).`
          : `📄 Read **${lineCount}** line(s) from file. File cleared.`,
        ephemeral: true,
      });
      return;
    }
    case "tokens_file_path": {
      if (!(await ownerGuard(i))) return;
      ensureIncomingTokensFile();
      await i.reply({
        content:
          `📄 Drop your tokens here, one per line:\n` +
          `\`${INCOMING_TOKENS_FILE}\`\n\n` +
          `Format: \`userId,accessToken,refreshToken\`\n` +
          `Lines starting with \`#\` are ignored.\n` +
          `Then run \`/load_tokens\`.`,
        ephemeral: true,
      });
      return;
    }
    case "autoping_test": {
      if (!(await ownerGuard(i))) return;
      const cfg = getAutoPing(i.guildId!);
      if (!cfg) {
        await i.reply({
          content: "❌ Auto-ping isn't configured. Use `/autoping_set` first.",
          ephemeral: true,
        });
        return;
      }
      const member = await i.guild!.members.fetch(i.user.id).catch(() => null);
      if (!member) {
        await i.reply({ content: "❌ Couldn't fetch your member info.", ephemeral: true });
        return;
      }
      const r = await sendAutoPing(member, cfg);
      await i.reply({
        content: r.ok
          ? `✅ Test ping sent in <#${cfg.channelId}>.`
          : `❌ Failed: ${r.reason}`,
        ephemeral: true,
      });
      return;
    }

    default:
      await i.reply({ content: `❌ Unknown command: \`${cmd}\``, ephemeral: true });
  }
}

// Suppress unused-import warning for PermissionFlagsBits
void PermissionFlagsBits;
void PREFIX;
