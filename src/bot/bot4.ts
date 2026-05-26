import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
  Partials,
  type TextChannel,
} from "discord.js";
import { BOT4_TOKEN, COLOR, HARDCODED_OWNERS } from "../config.js";
import { isAuthorizedMember } from "./permissions.js";
import { readRoleLimits } from "../storage/roles.js";
import {
  insertTokens,
  claimTokens,
  poolSize,
  clearPool,
  recordClaim,
  getClaimCount,
} from "../storage/customTokens.js";
import { readStoredTokens, writeStoredTokens } from "../storage/tokens.js";
import { stockEmbed } from "./embeds.js";

const PREFIX = "?";

export async function startBot4(): Promise<void> {
  if (!BOT4_TOKEN) {
    console.log("[bot4] TOKEN_4 not set — token distributor bot will not connect");
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  client.once(Events.ClientReady, (c) => {
    console.log(`[bot4] token distributor ready as ${c.user.tag}`);
  });

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    const parts = message.content.slice(PREFIX.length).trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return;
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    const guildOwnerId = message.guild.ownerId;
    const userId = message.author.id;
    const member = await message.guild.members.fetch(userId).catch(() => null);
    const isOwner = isAuthorizedMember(guildOwnerId, message.guild.id, userId, member);

    try {
      // ── ?insert <token1> <token2> … ── owner only ─────────────────────────
      if (cmd === "insert") {
        if (!isOwner) {
          await message.reply({ embeds: [denyEmbed()] }).catch(() => {});
          return;
        }

        // Tokens can be space-separated, newline-separated, or comma-separated
        const raw = message.content.slice(PREFIX.length + "insert".length).trim();
        const tokens = raw
          .split(/[\s,]+/)
          .map((t) => t.trim())
          .filter(Boolean);

        if (tokens.length === 0) {
          await message.reply(
            `Usage: \`${PREFIX}insert <token1> <token2> …\`\nYou can separate tokens with spaces, commas, or new lines.`,
          );
          return;
        }

        const added = insertTokens(tokens);
        const total = poolSize();
        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("✅ Tokens Inserted")
              .setColor(COLOR.green)
              .addFields(
                { name: "Added", value: String(added), inline: true },
                { name: "Skipped (duplicates)", value: String(tokens.length - added), inline: true },
                { name: "Pool Total", value: String(total), inline: true },
              )
              .setFooter({ text: "Bot 4 — Token Distributor" })
              .setTimestamp(),
          ],
        });
        return;
      }

      // ── ?4restock <count> ── owner only — pulls N tokens from stored stock ─
      if (cmd === "4restock") {
        if (!isOwner) {
          await message.reply({ embeds: [denyEmbed()] }).catch(() => {});
          return;
        }

        const countArg = parseInt(args[0] ?? "", 10);
        if (!args[0] || isNaN(countArg) || countArg <= 0) {
          await message.reply(`Usage: \`${PREFIX}4restock <count>\`\nExample: \`${PREFIX}4restock 50\``);
          return;
        }

        const stored = readStoredTokens();
        if (stored.length === 0) {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle("⚠️ No Stored Tokens")
                .setDescription("There are no tokens in stored stock to pull from.")
                .setColor(COLOR.yellow)
                .setFooter({ text: "Bot 4 — Token Distributor" }),
            ],
          });
          return;
        }

        const toMove = stored.slice(0, countArg);
        const remaining = stored.slice(countArg);

        // Format each entry as a full token line and add to Bot 4's pool
        const tokenLines = toMove.map((u) => `${u.userId},${u.accessToken},${u.refreshToken}`);
        const added = insertTokens(tokenLines);

        // Remove moved tokens from stored stock
        writeStoredTokens(remaining);

        const total = poolSize();
        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("📦 Restock Complete")
              .setColor(COLOR.green)
              .addFields(
                { name: "Moved to Pool", value: String(added), inline: true },
                { name: "Left in Stored", value: String(remaining.length), inline: true },
                { name: "Pool Total", value: String(total), inline: true },
              )
              .setFooter({ text: "Bot 4 — Token Distributor" })
              .setTimestamp(),
          ],
        });
        return;
      }

      // ── ?generate ── public ───────────────────────────────────────────────
      if (cmd === "generate") {
        // Determine how many tokens this user gets based on their highest role tier
        const guildTiers = readRoleLimits()[message.guild.id] ?? {};
        let tierLimit = 2; // default
        for (const [roleId, limit] of Object.entries(guildTiers)) {
          if (member?.roles.cache.has(roleId) && (limit as number) > tierLimit) {
            tierLimit = limit as number;
          }
        }

        const available = poolSize();
        if (available === 0) {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle("📦 Pool Empty")
                .setDescription("There are no tokens available right now. Check back later.")
                .setColor(COLOR.yellow)
                .setFooter({ text: "Bot 4 — Token Distributor" }),
            ],
          });
          return;
        }

        const count = Math.min(tierLimit, available);
        const tokens = claimTokens(count);
        if (tokens.length === 0) {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle("📦 Pool Empty")
                .setDescription("There are no tokens available right now. Check back later.")
                .setColor(COLOR.yellow)
                .setFooter({ text: "Bot 4 — Token Distributor" }),
            ],
          });
          return;
        }

        recordClaim(userId, tokens.length);

        // DM the tokens to the user
        try {
          const dmChannel = await message.author.createDM();
          await dmChannel.send({
            embeds: [
              new EmbedBuilder()
                .setTitle("🎁 Your Tokens")
                .setDescription(
                  `Here are your **${tokens.length}** token(s):\n\n` +
                  tokens.map((t, i) => `\`${i + 1}.\` \`${t}\``).join("\n"),
                )
                .setColor(COLOR.blurple)
                .setFooter({ text: "Bot 4 — Token Distributor" })
                .setTimestamp(),
            ],
          });

          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle("✅ Tokens Sent")
                .setDescription(`**${tokens.length}** token(s) have been sent to your DMs.`)
                .setColor(COLOR.green)
                .setFooter({ text: "Bot 4 — Token Distributor" }),
            ],
          });
        } catch {
          // DMs are closed — send in channel as ephemeral-style fallback
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle("❌ Could Not DM You")
                .setDescription(
                  "Please enable DMs from server members and try again.\n" +
                  "*(Server Settings → Privacy Settings → Allow direct messages)*",
                )
                .setColor(COLOR.red)
                .setFooter({ text: "Bot 4 — Token Distributor" }),
            ],
          });
          // Return the tokens to the pool since delivery failed
          insertTokens(tokens);
          recordClaim(userId, -tokens.length);
        }
        return;
      }

      // ── ?tokencount ── owner only ─────────────────────────────────────────
      if (cmd === "tokencount") {
        if (!isOwner) {
          await message.reply({ embeds: [denyEmbed()] }).catch(() => {});
          return;
        }
        const total = poolSize();
        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("📊 Token Pool Status")
              .setDescription(`**${total}** token(s) remaining in the pool.`)
              .setColor(COLOR.blurple)
              .setFooter({ text: "Bot 4 — Token Distributor" }),
          ],
        });
        return;
      }

      // ── ?clearpool ── owner only ──────────────────────────────────────────
      if (cmd === "clearpool") {
        if (!isOwner) {
          await message.reply({ embeds: [denyEmbed()] }).catch(() => {});
          return;
        }
        const before = poolSize();
        clearPool();
        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("🧹 Pool Cleared")
              .setDescription(`Removed **${before}** token(s) from the pool.`)
              .setColor(COLOR.red)
              .setFooter({ text: "Bot 4 — Token Distributor" }),
          ],
        });
        return;
      }

      // ── ?myclaimcount ── shows how many the calling user has claimed ──────
      if (cmd === "myclaimcount") {
        const total = getClaimCount(userId);
        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("📋 Your Claim Count")
              .setDescription(`You have claimed **${total}** token(s) total.`)
              .setColor(COLOR.blurple)
              .setFooter({ text: "Bot 4 — Token Distributor" }),
          ],
        });
        return;
      }

      // ── ?livestock ── posts a stock snapshot embed ───────────────────────
      if (cmd === "livestock") {
        const channel = message.channel as TextChannel;
        await channel.send({ embeds: [stockEmbed()] });
        return;
      }

      // ── ?bot4help ─────────────────────────────────────────────────────────
      if (cmd === "bot4help") {
        const isHardcoded = HARDCODED_OWNERS.includes(userId);
        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("📖 Bot 4 Commands")
              .setColor(COLOR.blurple)
              .addFields(
                {
                  name: "👤 Public",
                  value:
                    `\`${PREFIX}generate\` — claim tokens to your DMs based on your role\n` +
                    `\`${PREFIX}myclaimcount\` — see how many you've claimed total\n` +
                    `\`${PREFIX}livestock\` — post the current stock snapshot`,
                },
                ...(isOwner || isHardcoded
                  ? [
                      {
                        name: "🔒 Owner Only",
                        value:
                          `\`${PREFIX}4restock <count>\` — pull N tokens from stored stock into pool\n` +
                          `\`${PREFIX}insert <tokens…>\` — add tokens to the pool\n` +
                          `\`${PREFIX}tokencount\` — see pool size\n` +
                          `\`${PREFIX}clearpool\` — wipe the pool`,
                      },
                    ]
                  : []),
              )
              .setFooter({ text: "Bot 4 — Token Distributor" }),
          ],
        });
        return;
      }

    } catch (err) {
      console.error("[bot4] error", err);
      await message.reply("❌ An error occurred.").catch(() => {});
    }
  });

  client.on(Events.Error, (e) => console.error("[bot4] error", e));
  await client.login(BOT4_TOKEN);
}

function denyEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🚫 Access Denied")
    .setDescription("This command is for owners only.")
    .setColor(COLOR.red)
    .setFooter({ text: "Bot 4 — Token Distributor" });
}
