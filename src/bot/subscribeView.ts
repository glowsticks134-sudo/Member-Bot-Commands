import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
} from "discord.js";
import { dbAdd, dbRemove } from "../storage/subscribers.js";

export function subscribeComponents(): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("gecko:subscribe")
      .setLabel("Subscribe")
      .setEmoji("🔔")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("gecko:unsubscribe")
      .setLabel("Unsubscribe")
      .setEmoji("🔕")
      .setStyle(ButtonStyle.Danger),
  );
  return [row];
}

export async function handleSubscribeButton(
  interaction: ButtonInteraction,
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      content: "This only works inside a server.",
      ephemeral: true,
    });
    return;
  }
  if (interaction.customId === "gecko:subscribe") {
    const added = dbAdd(interaction.guildId, interaction.user.id);
    await interaction.reply({
      content: added
        ? "✅ You're subscribed! You'll get announcements via DM."
        : "ℹ️ You were already subscribed.",
      ephemeral: true,
    });
  } else {
    const removed = dbRemove(interaction.guildId, interaction.user.id);
    await interaction.reply({
      content: removed
        ? "✅ You've been unsubscribed. No more DMs."
        : "ℹ️ You weren't subscribed.",
      ephemeral: true,
    });
  }
}
