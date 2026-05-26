import { Client, GatewayIntentBits, EmbedBuilder, Events } from "discord.js";
import { BOT3_TOKEN, COLOR, PREFIX } from "../config.js";
import { isAuthorizedMember } from "./permissions.js";
import { isAllowedGuild } from "../storage/allowedGuilds.js";
import { isBlacklisted } from "../storage/blacklist.js";
import { readRoleLimits } from "../storage/roles.js";
import { readAuthUsers } from "../storage/tokens.js";
import { checkChannelLock } from "../storage/locks.js";
import * as E from "./embeds.js";
import {
  startDjoinJob,
  updateDjoinJob,
  finishDjoinJob,
  isJobRunning,
  checkCooldown,
  setCooldown,
  DJOIN_COOLDOWN_MS,
} from "../storage/djoinQueue.js";
import { doMassJoin } from "./restock.js";

export async function startJoinerBot(): Promise<void> {
  if (!BOT3_TOKEN) {
    console.log("[bot3] TOKEN_3 not set — joiner bot will not connect (falls back to Bot 1 for guild adds)");
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ],
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`[bot3] joiner bot ready as ${c.user.tag}`);
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;
    if (isBlacklisted(message.author.id)) return;

    const parts = message.content.slice(PREFIX.length).trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return;
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (cmd !== "djoin") return;

    const guildOwnerId = message.guild.ownerId;
    const userId = message.author.id;
    const member = await message.guild.members.fetch(userId).catch(() => null);
    const isOwner = isAuthorizedMember(guildOwnerId, message.guild.id, userId, member);

    try {
      // !djoin status — owner only
      if (args[0]?.toLowerCase() === "status") {
        if (!isOwner) {
          await message.reply({ embeds: [E.denyEmbed()] }).catch(() => {});
          return;
        }
        const { getActiveJobs } = await import("../storage/djoinQueue.js");
        const jobs = getActiveJobs();
        const running = jobs.filter((j) => j.status === "running");
        const recent = jobs.filter((j) => j.status !== "running");
        const lines: string[] = [];
        if (running.length > 0) {
          lines.push("**⏳ Running:**");
          for (const j of running) {
            const elapsed = Math.floor((Date.now() - j.startedAt.getTime()) / 1000);
            lines.push(`• **${j.serverName}** — ${j.done}/${j.total} (${elapsed}s) — <@${j.requestedBy}>`);
          }
        }
        if (recent.length > 0) {
          lines.push("\n**📋 Recently finished:**");
          for (const j of recent) {
            lines.push(`• ${j.status === "done" ? "✅" : "❌"} **${j.serverName}** — ${j.done}/${j.total} — <@${j.requestedBy}>`);
          }
        }
        if (lines.length === 0) lines.push("No active or recent djoin jobs.");
        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("🔧 Djoin Worker Status")
              .setDescription(lines.join("\n"))
              .setColor(COLOR.blurple)
              .setTimestamp(new Date())
              .setFooter({ text: `Cooldown: ${DJOIN_COOLDOWN_MS / 1000}s per user/server • Memberk` }),
          ],
        });
        return;
      }

      if (args.length === 0) {
        await message.reply(
          `Usage: \`!djoin <server_id> [amount]\`\n` +
          `Cooldown: **${DJOIN_COOLDOWN_MS / 1000}s** per user and per server`,
        );
        return;
      }

      const lock = checkChannelLock(message.guild.id, "djoin", message.channel.id);
      if (lock) {
        await message.reply({ embeds: [E.channelLockedEmbed(lock, "djoin")] });
        return;
      }

      const serverId = args[0];
      let amount: number | undefined = args[1] ? parseInt(args[1], 10) : undefined;
      if (amount !== undefined && (isNaN(amount) || amount < 1)) {
        await message.reply("❌ Amount must be a positive number. Example: `!djoin 123456789 10`");
        return;
      }

      // Non-owners are capped by their tier limit
      if (!isOwner) {
        const guildTiers = readRoleLimits()[message.guild.id] ?? {};
        let tierLimit = 2;
        for (const [roleId, limit] of Object.entries(guildTiers)) {
          if (member?.roles.cache.has(roleId) && (limit as number) > tierLimit) {
            tierLimit = limit as number;
          }
        }
        if (amount === undefined || amount > tierLimit) {
          amount = tierLimit;
        }
      }

      // Check cooldown
      const cooldownRemaining = checkCooldown(userId, serverId);
      if (cooldownRemaining > 0) {
        const secs = Math.ceil(cooldownRemaining / 1000);
        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("⏳ Cooldown Active")
              .setDescription(
                `You must wait **${secs}s** before using \`!djoin\` on this server again.\n\nCooldown: **${DJOIN_COOLDOWN_MS / 1000}s** per user and per server.`,
              )
              .setColor(COLOR.yellow)
              .setFooter({ text: "Memberk" }),
          ],
        });
        return;
      }

      // Check if a job is already running for this server
      if (isJobRunning(serverId)) {
        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("⚠️ Already Running")
              .setDescription(
                `A djoin is already in progress for server \`${serverId}\`. Use \`!djoin status\` to check status.`,
              )
              .setColor(COLOR.yellow)
              .setFooter({ text: "Memberk" }),
          ],
        });
        return;
      }

      const targetGuild = client.guilds.cache.get(serverId);
      const serverName = targetGuild?.name ?? serverId;
      const stockCount = readAuthUsers().length;

      startDjoinJob({
        serverId,
        serverName,
        requestedBy: userId,
        startedAt: new Date(),
        total: amount ?? stockCount,
        done: 0,
        status: "running",
      });
      setCooldown(userId, serverId);

      const progress = await message.reply("⏳ Starting mass join…");
      let lastDone = 0;
      const e = await doMassJoin(serverId, client, async (txt) => {
        try {
          await progress.edit({ content: txt });
          const match = txt.match(/(\d+)\//);
          if (match) {
            lastDone = parseInt(match[1], 10);
            updateDjoinJob(serverId, lastDone, amount ?? stockCount);
          }
        } catch {
          /* noop */
        }
      }, amount);
      finishDjoinJob(serverId, e ? "done" : "failed");
      if (e) await progress.edit({ content: "", embeds: [e] });

    } catch (err) {
      console.error("[bot3] djoin error", err);
      await message.reply("❌ An error occurred while running djoin.").catch(() => {});
    }
  });

  client.on(Events.Error, (e) => console.error("[bot3] error", e));
  await client.login(BOT3_TOKEN);
}
