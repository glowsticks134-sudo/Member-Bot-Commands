import {
  ApplicationCommandOptionType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  REST,
  Routes,
  type ChatInputCommandInteraction,
  type RESTPostAPIApplicationCommandsJSONBody,
  type Client,
} from "discord.js";

import {
  BOT_TOKEN,
  CLIENT_ID,
  COLOR,
  MAIN_GUILD_ID,
  HARDCODED_OWNERS,
  SUPER_OWNER_ID,
} from "../config.js";
import { addAllowedGuild, isAllowedGuild, removeAllowedGuild } from "../storage/allowedGuilds.js";
import { addBlacklisted, isBlacklisted, removeBlacklisted } from "../storage/blacklist.js";
import { readStoredTokens } from "../storage/tokens.js";
import { setBotLogChannel, clearBotLogChannel } from "../storage/botLog.js";
import {
  setStatusRoleConfig,
  getStatusRoleConfig,
  clearStatusRoleConfig,
  setLogChannel,
} from "../storage/statusRoles.js";
import * as E from "./embeds.js";
import { isAuthorizedMember } from "./permissions.js";
import { doCheckTokens, doMassJoin } from "./restock.js";
import { handleInfoCommand } from "./infoCommands.js";
import type { BotState } from "./client.js";

const O = ApplicationCommandOptionType;

// ─── Slash command definitions ─────────────────────────────────────────────────

export function buildSlashDefinitions(): RESTPostAPIApplicationCommandsJSONBody[] {
  return [
    // Public
    { name: "count", description: "Show how many users are authenticated", type: 1 },
    { name: "list_users", description: "List all authenticated users", type: 1 },
    { name: "servers", description: "List all servers the bot is in", type: 1 },
    {
      name: "server_age",
      description: "Check how long the bot has been in a server",
      type: 1,
      options: [
        { name: "server_id", description: "Server ID (omit to list all)", type: O.String, required: false },
      ],
    },
    { name: "invite", description: "Get the bot invite link", type: 1 },
    { name: "addbot", description: "Post an Add Bot button so members can invite the bot to their server", type: 1 },
    { name: "help", description: "Show all available commands", type: 1 },

    // Owner
    {
      name: "djoin",
      description: "Add all authenticated users to a server (owners only)",
      type: 1,
      options: [
        { name: "server_id", description: "Target server ID", type: O.String, required: true },
      ],
    },
    { name: "check_tokens", description: "Check and refresh all stored tokens (owners only)", type: 1 },

    // Super-owner
    {
      name: "blacklist",
      description: "Blacklist a user from using the bot (super-owner only)",
      type: 1,
      options: [
        { name: "user_id", description: "Discord user ID to blacklist", type: O.String, required: true },
      ],
    },
    {
      name: "unblacklist",
      description: "Remove a user from the blacklist (super-owner only)",
      type: 1,
      options: [
        { name: "user_id", description: "Discord user ID to unblacklist", type: O.String, required: true },
      ],
    },
    { name: "blacklist_list", description: "Show all blacklisted users (super-owner only)", type: 1 },
    {
      name: "enable_server",
      description: "Allow another server to use this bot (super-owner only)",
      type: 1,
      options: [
        { name: "server_id", description: "Guild ID to enable", type: O.String, required: true },
      ],
    },
    {
      name: "disable_server",
      description: "Disable a server from using this bot (super-owner only)",
      type: 1,
      options: [
        { name: "server_id", description: "Guild ID to disable", type: O.String, required: true },
      ],
    },
    { name: "list_allowed_servers", description: "List all allowed servers (super-owner only)", type: 1 },

    // ─── Info / Server embeds ─────────────────────────────────────────────
    { name: "rules",           description: "Post the server rules embed",                                    type: 1 },
    { name: "tos",             description: "Post the Terms of Service embed",                                type: 1 },
    { name: "info",            description: "Post information about Memberk",                                 type: 1 },
    { name: "howto",           description: "Post a how-to-use guide",                                       type: 1 },
    { name: "payment_methods", description: "Post accepted payment methods",                                  type: 1 },
    { name: "invite_rewards",  description: "Post invite reward tiers",                                      type: 1 },
    {
      name: "role_plans",
      description: "Set pricing and post the role plans embed (owners only)",
      type: 1,
      options: [
        { name: "bronze",   description: "Bronze price (5 members/djoin)",   type: O.String, required: false },
        { name: "silver",   description: "Silver price (10 members/djoin)",  type: O.String, required: false },
        { name: "gold",     description: "Gold price (15 members/djoin)",    type: O.String, required: false },
        { name: "premium",  description: "Premium price (20 members/djoin)", type: O.String, required: false },
        { name: "diamond",  description: "Diamond price (25 members/djoin)", type: O.String, required: false },
        { name: "emerald",  description: "Emerald price (30 members/djoin)", type: O.String, required: false },
        { name: "obsidian", description: "Obsidian price (35 members/djoin)",type: O.String, required: false },
      ],
    },
    { name: "private_bot",     description: "Set pricing and post a private bot listing (owners only)",       type: 1 },

    // ─── Free Bronze / Status Role ────────────────────────────────────────
    {
      name: "free_bronze_role",
      description: "Post the Free Bronze Role embed with a copyable status text (owners only)",
      type: 1,
      options: [
        { name: "invite_link", description: "The text/link members need to add to their Discord status", type: O.String, required: true },
        { name: "role",        description: "The role to grant",                                         type: O.Role,   required: true },
      ],
    },
    {
      name: "status_role_set",
      description: "Grant a role when members add a specific link to their Discord status (owners only)",
      type: 1,
      options: [
        { name: "invite_link", description: "Invite link or text to watch for in member status", type: O.String, required: true },
        { name: "role",        description: "Role to grant when the link is detected",           type: O.Role,   required: true },
      ],
    },
    { name: "status_role_clear",  description: "Remove the status invite role config (owners only)",  type: 1 },
    { name: "status_role_status", description: "Show the current status invite role config",           type: 1 },
    {
      name: "bronze_log_set",
      description: "Set the channel where free bronze role grants/removals are logged (owners only)",
      type: 1,
      options: [
        { name: "channel", description: "Channel to send bronze role logs to", type: O.Channel, required: true, channel_types: [ChannelType.GuildText] },
      ],
    },

    // ─── Bot log channel ──────────────────────────────────────────────────
    {
      name: "set_log_channel",
      description: "Set the channel where all bot activity logs are sent (owners only)",
      type: 1,
      options: [
        { name: "channel", description: "Channel to send all bot logs to", type: O.Channel, required: true, channel_types: [ChannelType.GuildText] },
      ],
    },
    { name: "clear_log_channel", description: "Remove the bot log channel (owners only)", type: 1 },
  ];
}

export async function registerCommandsForGuild(guildId: string): Promise<void> {
  if (!BOT_TOKEN || !CLIENT_ID) return;
  const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);
  const body = buildSlashDefinitions();
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body });
    console.log(`[commands] registered ${body.length} commands for guild ${guildId}`);
  } catch (e) {
    console.error(`[commands] failed to register for guild ${guildId}`, e);
  }
}

// ─── Guards ────────────────────────────────────────────────────────────────────

function isSuperOwner(userId: string): boolean {
  return userId === SUPER_OWNER_ID || HARDCODED_OWNERS.includes(userId);
}

async function ownerGuard(i: ChatInputCommandInteraction): Promise<boolean> {
  if (!i.guild) {
    await i.reply({ content: "❌ This command must be used inside a server.", ephemeral: true });
    return false;
  }
  const member = await i.guild.members.fetch(i.user.id).catch(() => null);
  if (isAuthorizedMember(i.guild.ownerId, i.guild.id, i.user.id, member)) return true;
  await i.reply({
    embeds: [new EmbedBuilder()
      .setTitle("❌ Access Denied")
      .setDescription("Only the **server owner** or a designated **owner** can use this command.")
      .setColor(COLOR.red)],
    ephemeral: true,
  });
  return false;
}

async function superOwnerGuard(i: ChatInputCommandInteraction): Promise<boolean> {
  if (isSuperOwner(i.user.id)) return true;
  await i.reply({
    embeds: [new EmbedBuilder()
      .setTitle("🔒 Private Command")
      .setDescription("This command can only be used by the **bot's super-owner**.")
      .setColor(COLOR.red)],
    ephemeral: true,
  });
  return false;
}

async function wrongGuildGuard(i: ChatInputCommandInteraction): Promise<boolean> {
  if (!i.guildId || (i.guildId !== MAIN_GUILD_ID && !isAllowedGuild(i.guildId))) {
    await i.reply({
      embeds: [new EmbedBuilder()
        .setTitle("🚫 Wrong Server")
        .setDescription(
          "Memberk bot commands **only work in the official Memberk server**.\n\n" +
          "🛡️ Any other server claiming to use this bot is a **scam** — do not trust it.",
        )
        .setColor(COLOR.red)],
      ephemeral: true,
    });
    return false;
  }
  return true;
}

async function blacklistGuard(i: ChatInputCommandInteraction): Promise<boolean> {
  if (isBlacklisted(i.user.id)) {
    await i.reply({
      embeds: [new EmbedBuilder()
        .setTitle("⛔ You Are Blacklisted")
        .setDescription("You have been **blacklisted** from using this bot.\n\nContact the super-owner if you think this is a mistake.")
        .setColor(COLOR.red)],
      ephemeral: true,
    });
    return false;
  }
  return true;
}

// ─── Command dispatch ─────────────────────────────────────────────────────────

export async function handleSlash(
  i: ChatInputCommandInteraction,
  state: BotState,
  client: Client,
): Promise<void> {
  if (!(await blacklistGuard(i))) return;
  if (!(await wrongGuildGuard(i))) return;

  const cmd = i.commandName;

  switch (cmd) {

    // ─── Public ─────────────────────────────────────────────────────────────

    case "count": {
      const n = readStoredTokens().length;
      await i.reply({
        embeds: [new EmbedBuilder()
          .setTitle("📊 Authenticated Users")
          .setDescription(`There are currently **${n}** authenticated user(s).`)
          .setColor(COLOR.blurple)
          .setTimestamp()],
      });
      return;
    }

    case "list_users": {
      await i.reply({ embeds: [E.listUsersEmbed()] });
      return;
    }

    case "servers": {
      await i.reply({ embeds: [E.serversEmbed(client, state.serverJoinTimes)] });
      return;
    }

    case "server_age": {
      const sid = i.options.getString("server_id");
      await i.reply({ embeds: [E.serverAgeEmbed(sid, client, state.serverJoinTimes)] });
      return;
    }

    case "invite": {
      const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands`;
      await i.reply({
        embeds: [new EmbedBuilder()
          .setTitle("🤖 Bot Invite Link")
          .setDescription(
            `[👉 Click here to add the bot to a server](${url})\n\n` +
            `⚠️ The bot automatically **leaves servers after 14 days** (except the main server).`,
          )
          .setColor(COLOR.blurple)
          .setTimestamp()],
      });
      return;
    }

    case "addbot": {
      if (!(await ownerGuard(i))) return;
      const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands`;
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("Add Bot")
          .setStyle(ButtonStyle.Link)
          .setURL(url)
          .setEmoji("🔗"),
      );
      await i.reply({
        embeds: [new EmbedBuilder()
          .setDescription(
            "Click the button below to add the bot to your server.\nOnce it's in, come back and use `!djoin` to join members.",
          )
          .setColor(COLOR.blurple)],
        components: [row],
      });
      return;
    }

    case "help": {
      await i.reply({ embeds: [E.helpEmbed()], ephemeral: true });
      return;
    }

    // ─── Owner ───────────────────────────────────────────────────────────────

    case "djoin": {
      if (!(await ownerGuard(i))) return;
      const serverId = i.options.getString("server_id", true).trim();
      if (!/^\d+$/.test(serverId)) {
        await i.reply({ content: "❌ Invalid server ID — must be a numeric Discord server ID.", ephemeral: true });
        return;
      }
      const guild = client.guilds.cache.get(serverId);
      if (!guild) {
        const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands`;
        await i.reply({
          embeds: [new EmbedBuilder()
            .setTitle("❌ Bot Not in Server")
            .setDescription(
              `Bot is not in server \`${serverId}\`.\n\n` +
              `[Add the bot to that server first](${inviteUrl}), then run \`/djoin\` again.`,
            )
            .setColor(COLOR.red)],
          ephemeral: true,
        });
        return;
      }
      const users = readStoredTokens();
      if (users.length === 0) {
        await i.reply({
          embeds: [new EmbedBuilder()
            .setTitle("📭 No Authenticated Users")
            .setDescription("No users have authenticated yet.\n\nShare `/get_token` so members can authorize their accounts.")
            .setColor(COLOR.yellow)],
          ephemeral: true,
        });
        return;
      }
      await i.deferReply({ ephemeral: true });
      const statusMsg = await i.followUp({
        content: `🚀 **Mass join started** — adding **${users.length}** user(s) to **${guild.name}**…`,
        ephemeral: true,
      });
      const result = await doMassJoin(serverId, client, async (text) => {
        await statusMsg.edit(text).catch(() => {});
      });
      if (result) {
        await i.editReply({ embeds: [result] });
      }
      return;
    }

    case "check_tokens": {
      if (!(await ownerGuard(i))) return;
      await i.deferReply({ ephemeral: true });
      await i.editReply({ embeds: [await doCheckTokens()] });
      return;
    }

    // ─── Super-owner ─────────────────────────────────────────────────────────

    case "blacklist": {
      if (!(await superOwnerGuard(i))) return;
      const uid = i.options.getString("user_id", true).trim();
      if (!/^\d{5,25}$/.test(uid)) {
        await i.reply({ content: "❌ That doesn't look like a valid Discord user ID.", ephemeral: true });
        return;
      }
      if (isSuperOwner(uid)) {
        await i.reply({ content: "❌ You can't blacklist an owner.", ephemeral: true });
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
        await i.reply({ content: "❌ That doesn't look like a valid server ID.", ephemeral: true });
        return;
      }
      if (sid === MAIN_GUILD_ID) {
        await i.reply({ content: "ℹ️ The main server is always allowed.", ephemeral: true });
        return;
      }
      const added = addAllowedGuild(sid);
      if (client.guilds.cache.has(sid)) {
        await registerCommandsForGuild(sid).catch(() => {});
      }
      await i.reply({
        content: added
          ? `✅ Server \`${sid}\` is now **allowed** to use this bot.`
          : `ℹ️ Server \`${sid}\` was already allowed.`,
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
      await i.reply({ embeds: [E.allowedGuildsEmbed(MAIN_GUILD_ID)], ephemeral: true });
      return;
    }

    // ─── Info embeds ─────────────────────────────────────────────────────────

    case "rules":
    case "tos":
    case "info":
    case "howto":
    case "payment_methods":
    case "invite_rewards":
    case "role_plans":
    case "private_bot":
      if (!(await ownerGuard(i))) return;
      await handleInfoCommand(i);
      return;

    // ─── Free Bronze / Status Role ────────────────────────────────────────────

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
          `Use \`/free_bronze_role\` to post the member-facing embed.\n` +
          `⚠️ Requires the **Presence Intent** enabled in your Discord Developer Portal.`,
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
            `• Grants role: <@&${cfg.roleId}>` +
            (cfg.logChannelId ? `\n• Log channel: <#${cfg.logChannelId}>` : ""),
          ephemeral: true,
        });
      }
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

    // ─── Bot log channel ──────────────────────────────────────────────────────

    case "set_log_channel": {
      if (!(await ownerGuard(i))) return;
      const channel = i.options.getChannel("channel", true);
      setBotLogChannel(i.guildId!, channel.id);
      await i.reply({
        content:
          `✅ Bot logs will now be sent to <#${channel.id}>.\n\n` +
          `**Logged events:**\n` +
          `• 🔑 Member OAuth token saved\n` +
          `• 🚀 Mass join (\`/djoin\`) completed\n` +
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
      const cleared2 = clearBotLogChannel(i.guildId!);
      await i.reply({
        content: cleared2 ? "✅ Bot log channel removed." : "ℹ️ No log channel was set.",
        ephemeral: true,
      });
      return;
    }

    default:
      await i.reply({ content: `❌ Unknown command: \`${cmd}\``, ephemeral: true });
  }
}
