import { EmbedBuilder, type Client, type TextChannel } from "discord.js";
import { getBotLogChannel } from "../storage/botLog.js";

export async function sendBotLog(
  client: Client,
  guildId: string,
  embed: EmbedBuilder,
): Promise<void> {
  try {
    const channelId = getBotLogChannel(guildId);
    if (!channelId) return;
    const ch = await client.channels.fetch(channelId);
    if (ch && "send" in ch) {
      await (ch as TextChannel).send({ embeds: [embed] });
    }
  } catch {
    // silently ignore — log channel may be missing or bot lacks perms
  }
}

export async function sendBotLogRest(
  channelId: string,
  botToken: string,
  embed: object,
): Promise<void> {
  try {
    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch {
    // silently ignore
  }
}
