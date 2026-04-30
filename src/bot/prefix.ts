import { EmbedBuilder, type Client, type Message } from "discord.js";
import { COLOR, MAIN_GUILD_ID, PREFIX } from "../config.js";
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
  doRestock,
} from "./restock.js";
import { controlPanelComponents, controlPanelEmbed } from "./controlPanel.js";
import { subscribeComponents } from "./subscribeView.js";
import type { BotState } from "./client.js";

const OWNER_PREFIX_CMDS = new Set([
  "restock", "clear_stock", "djoin", "cleanup_servers", "control_panel",
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
    } else if (OWNER_PREFIX_CMDS.has(cmd)) {
      if (!isOwner) {
        await message.reply({ embeds: [E.denyEmbed()] });
        return;
      }
      if (cmd === "restock") {
        let raw = args.join(" ").trim();
        if (message.attachments.size > 0) {
          const att = message.attachments.first()!;
          try {
            raw = await (await fetch(att.url)).text();
          } catch {
            await message.reply("❌ Could not download the attachment.");
            return;
          }
        }
        if (!raw) {
          await message.reply({ embeds: [E.noTokensEmbed()] });
          return;
        }
        const loading = await message.reply("🔄 Restocking…");
        const e = await doRestock(raw);
        await loading.edit({ content: "", embeds: [e] });
      } else if (cmd === "clear_stock") {
        clearStock();
        await message.reply("🧹 Stock cleared.");
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
