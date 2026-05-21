import {
  ActivityType,
  EmbedBuilder,
  Events,
  type Client,
  type TextChannel,
} from "discord.js";
import { COLOR } from "../config.js";
import { getStatusRoleConfig } from "../storage/statusRoles.js";
import { sendBotLog } from "./logger.js";

async function sendLog(
  client: Client,
  channelId: string,
  embed: EmbedBuilder,
): Promise<void> {
  try {
    const ch = await client.channels.fetch(channelId);
    if (ch && "send" in ch) {
      await (ch as TextChannel).send({ embeds: [embed] });
    }
  } catch {
    // log channel may be missing or bot lacks perms — silently ignore
  }
}

export function attachStatusWatcher(client: Client): void {
  client.on(Events.PresenceUpdate, async (_oldPresence, newPresence) => {
    try {
      const guildId = newPresence.guild?.id;
      if (!guildId) return;

      const cfg = getStatusRoleConfig(guildId);
      if (!cfg) return;

      const { inviteLink, roleId, logChannelId } = cfg;

      const member = newPresence.member;
      if (!member) return;

      const customStatus = newPresence.activities.find(
        (a) => a.type === ActivityType.Custom,
      );
      const statusText = customStatus?.state ?? "";
      const hasLink = statusText.toLowerCase().includes(inviteLink.toLowerCase());
      const alreadyHas = member.roles.cache.has(roleId);

      if (hasLink && !alreadyHas) {
        await member.roles.add(roleId, "Status invite link detected");
        console.log(`[statusWatcher] granted role ${roleId} to ${member.user.tag} in ${guildId}`);

        const grantEmbed = new EmbedBuilder()
          .setTitle("🥉 Free Bronze Log — Role Granted")
          .setColor(0xcd7f32)
          .setThumbnail(member.user.displayAvatarURL())
          .addFields(
            { name: "👤 Member",      value: `<@${member.id}> \`${member.user.tag}\``,  inline: true },
            { name: "🎭 Role",        value: `<@&${roleId}>`,                            inline: true },
            { name: "🔍 Status Text", value: `\`\`\`${statusText.slice(0, 200)}\`\`\`` },
          )
          .setFooter({ text: `User ID: ${member.id}` })
          .setTimestamp();

        if (logChannelId) await sendLog(client, logChannelId, grantEmbed);
        await sendBotLog(client, guildId, grantEmbed);
      } else if (!hasLink && alreadyHas) {
        await member.roles.remove(roleId, "Status invite link removed from status");
        console.log(`[statusWatcher] removed role ${roleId} from ${member.user.tag} in ${guildId}`);

        const removeEmbed = new EmbedBuilder()
          .setTitle("🥉 Free Bronze Log — Role Removed")
          .setColor(COLOR.red)
          .setThumbnail(member.user.displayAvatarURL())
          .addFields(
            { name: "👤 Member", value: `<@${member.id}> \`${member.user.tag}\``, inline: true },
            { name: "🎭 Role",   value: `<@&${roleId}>`,                           inline: true },
            { name: "📋 Reason", value: "Status link was removed from their Discord status." },
          )
          .setFooter({ text: `User ID: ${member.id}` })
          .setTimestamp();

        if (logChannelId) await sendLog(client, logChannelId, removeEmbed);
        await sendBotLog(client, guildId, removeEmbed);
      }
    } catch (e) {
      console.error("[statusWatcher] error", e);
    }
  });
}
