import {
  ChannelType,
  type Client,
  type GuildMember,
  type TextBasedChannel,
} from "discord.js";
import { getAutoPing, type AutoPingConfig } from "../storage/autoping.js";

export function renderAutoPingMessage(
  template: string,
  member: GuildMember,
): string {
  const guild = member.guild;
  return template
    .replaceAll("{user}", `<@${member.id}>`)
    .replaceAll("{username}", member.user.username)
    .replaceAll("{server}", guild.name)
    .replaceAll("{count}", String(guild.memberCount));
}

export async function sendAutoPing(
  member: GuildMember,
  cfg?: AutoPingConfig | null,
): Promise<{ ok: boolean; reason?: string }> {
  const config = cfg ?? getAutoPing(member.guild.id);
  if (!config) return { ok: false, reason: "Auto-ping is not configured." };

  const channel = await member.guild.channels
    .fetch(config.channelId)
    .catch(() => null);
  if (!channel) {
    return { ok: false, reason: "Configured channel no longer exists." };
  }
  if (
    channel.type !== ChannelType.GuildText &&
    channel.type !== ChannelType.GuildAnnouncement &&
    channel.type !== ChannelType.PublicThread &&
    channel.type !== ChannelType.PrivateThread &&
    channel.type !== ChannelType.AnnouncementThread
  ) {
    return { ok: false, reason: "Configured channel is not a text channel." };
  }

  const text = renderAutoPingMessage(config.message, member);
  const rolePing = config.mentionRoleId ? `<@&${config.mentionRoleId}> ` : "";
  const allowedRoles = config.mentionRoleId ? [config.mentionRoleId] : [];

  try {
    await (channel as TextBasedChannel & {
      send: (opts: unknown) => Promise<unknown>;
    }).send({
      content: `${rolePing}${text}`,
      allowedMentions: { users: [member.id], roles: allowedRoles },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

export function attachAutoPing(client: Client): void {
  client.on("guildMemberAdd", async (member) => {
    try {
      if (member.partial) return;
      const cfg = getAutoPing(member.guild.id);
      if (!cfg) return;
      const r = await sendAutoPing(member, cfg);
      if (!r.ok) {
        console.warn(
          `[autoping] failed in guild ${member.guild.id}: ${r.reason}`,
        );
      }
    } catch (e) {
      console.error("[autoping] handler error", e);
    }
  });
}
