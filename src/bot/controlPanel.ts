import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
} from "discord.js";
import { COLOR } from "../config.js";
import { isAuthorizedMember } from "./permissions.js";
import { denyEmbed, listUsersEmbed, ownersEmbed, statusEmbed, stockEmbed, countEmbed, serversEmbed } from "./embeds.js";
import { doCheckTokens, doCleanupServers } from "./restock.js";
import type { BotState } from "./client.js";

export function controlPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🛠️ Memberty Control Panel")
    .setDescription(
      "Quick access to common owner actions. Buttons are owner-only " +
        "and ephemeral — only the user who clicked sees the result.",
    )
    .setColor(COLOR.blurple)
    .setFooter({ text: "Memberty • Use the buttons below" });
}

function btn(
  label: string,
  customId: string,
  emoji: string,
  style: ButtonStyle = ButtonStyle.Secondary,
): ButtonBuilder {
  return new ButtonBuilder()
    .setLabel(label)
    .setCustomId(customId)
    .setEmoji(emoji)
    .setStyle(style);
}

export function controlPanelComponents(): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    btn("Stock", "cp:stock", "📦"),
    btn("Status", "cp:status", "🟢"),
    btn("Count", "cp:count", "📊"),
    btn("List Users", "cp:list_users", "👥"),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    btn("Check Tokens", "cp:check_tokens", "🔍", ButtonStyle.Primary),
    btn("Servers", "cp:servers", "🌐"),
    btn("Owners", "cp:owners", "👑"),
    btn("Cleanup Servers", "cp:cleanup", "🧹", ButtonStyle.Danger),
  );
  return [row1, row2];
}

export async function handleControlPanelButton(
  interaction: ButtonInteraction,
  state: BotState,
): Promise<void> {
  const cid = interaction.customId;
  const action = cid.includes(":") ? cid.split(":", 2)[1] : "";
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ content: "❌ Guild only.", ephemeral: true });
    return;
  }
  const guildOwnerId = guild.ownerId;
  const userId = interaction.user.id;
  const member = interaction.member && "roles" in interaction.member
    ? (await guild.members.fetch(userId).catch(() => null))
    : null;
  if (!isAuthorizedMember(guildOwnerId, guild.id, userId, member)) {
    await interaction.reply({ embeds: [denyEmbed()], ephemeral: true });
    return;
  }

  switch (action) {
    case "stock":
      await interaction.reply({ embeds: [stockEmbed()], ephemeral: true });
      break;
    case "status":
      await interaction.reply({
        embeds: [statusEmbed(interaction.client, state.botStartTime)],
        ephemeral: true,
      });
      break;
    case "count":
      await interaction.reply({ embeds: [countEmbed()], ephemeral: true });
      break;
    case "list_users": {
      const { embed } = listUsersEmbed();
      await interaction.reply({ embeds: [embed], ephemeral: true });
      break;
    }
    case "check_tokens": {
      await interaction.deferReply({ ephemeral: true });
      const e = await doCheckTokens();
      await interaction.followUp({ embeds: [e], ephemeral: true });
      break;
    }
    case "servers":
      await interaction.reply({
        embeds: [serversEmbed(interaction.client, state.serverJoinTimes)],
        ephemeral: true,
      });
      break;
    case "owners":
      await interaction.reply({
        embeds: [ownersEmbed(guildOwnerId, guild.id)],
        ephemeral: true,
      });
      break;
    case "cleanup": {
      await interaction.deferReply({ ephemeral: true });
      const e = await doCleanupServers(interaction.client, guild.id);
      await interaction.followUp({ embeds: [e], ephemeral: true });
      break;
    }
    default:
      await interaction.reply({ content: "❌ Unknown action.", ephemeral: true });
  }
}
