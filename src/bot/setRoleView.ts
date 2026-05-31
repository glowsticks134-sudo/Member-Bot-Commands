import {
  EmbedBuilder,
  StringSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ActionRowBuilder,
  type StringSelectMenuInteraction,
  type RoleSelectMenuInteraction,
} from "discord.js";
import { COLOR, MAX_ROLES_PER_GUILD } from "../config.js";
import { getGuildRoleLimits, setGuildRoleLimit } from "../storage/roles.js";
import { isAuthorizedMember } from "./permissions.js";

export const SETROLE_TIERS = [
  { value: "no_role",  label: "No Role (Default)", emoji: "🔓", limit: 2,  description: "2 members per /djoin — applies to all members" },
  { value: "bronze",   label: "Bronze",            emoji: "🥉", limit: 5,  description: "5 members per /djoin" },
  { value: "silver",   label: "Silver",            emoji: "🥈", limit: 10, description: "10 members per /djoin" },
  { value: "gold",     label: "Gold",              emoji: "🥇", limit: 15, description: "15 members per /djoin" },
  { value: "premium",  label: "Premium",           emoji: "💎", limit: 20, description: "20 members per /djoin" },
  { value: "diamond",  label: "Diamond",           emoji: "💠", limit: 25, description: "25 members per /djoin" },
  { value: "emerald",  label: "Emerald",           emoji: "💚", limit: 30, description: "30 members per /djoin" },
  { value: "obsidian", label: "Obsidian",          emoji: "🖤", limit: 35, description: "35 members per /djoin" },
] as const;

export function setRoleTierEmbed(): EmbedBuilder {
  const lines = SETROLE_TIERS.map(
    (t) => `${t.emoji} **${t.label}** — ${t.limit} members per \`/djoin\``,
  ).join("\n");
  return new EmbedBuilder()
    .setTitle("🎭 Set Role Limit")
    .setDescription(
      "Select a tier from the menu below.\n\n" +
      lines + "\n\n" +
      "_After picking a tier you'll be asked which Discord role to apply it to._",
    )
    .setColor(COLOR.yellow)
    .setFooter({ text: "Only visible to you" });
}

export function setRoleTierComponents(): ActionRowBuilder<StringSelectMenuBuilder>[] {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("setrole:tier_select")
    .setPlaceholder("Choose a tier…")
    .addOptions(
      SETROLE_TIERS.map((t) => ({
        label: t.label,
        value: t.value,
        description: t.description,
        emoji: t.emoji,
      })),
    );
  return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)];
}

export function setRolePickRoleEmbed(tierLabel: string, limit: number): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(`🎭 Set Role Limit — ${tierLabel}`)
    .setDescription(
      `You chose **${tierLabel}** → **${limit} members per \`/djoin\`**.\n\n` +
      `Now pick the Discord role you want to apply this tier to.`,
    )
    .setColor(COLOR.yellow)
    .setFooter({ text: "Only visible to you" });
}

export function setRolePickRoleComponents(
  tierValue: string,
  limit: number,
): ActionRowBuilder<RoleSelectMenuBuilder>[] {
  const menu = new RoleSelectMenuBuilder()
    .setCustomId(`setrole:role_select:${tierValue}:${limit}`)
    .setPlaceholder("Select a role…");
  return [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(menu)];
}

export async function handleSetRoleMenu(
  interaction: StringSelectMenuInteraction | RoleSelectMenuInteraction,
): Promise<void> {
  const guild = interaction.guild;
  const member = guild
    ? await guild.members.fetch(interaction.user.id).catch(() => null)
    : null;
  const guildOwnerId = guild?.ownerId ?? "";

  if (!isAuthorizedMember(guildOwnerId, guild?.id ?? "", interaction.user.id, member)) {
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("❌ Access Denied")
          .setDescription("Only owners can configure role limits.")
          .setColor(COLOR.red),
      ],
      components: [],
    });
    return;
  }

  if (interaction.isStringSelectMenu()) {
    const tierValue = interaction.values[0]!;
    const tier = SETROLE_TIERS.find((t) => t.value === tierValue);
    if (!tier) return;

    if (tierValue === "no_role") {
      setGuildRoleLimit(interaction.guildId!, "__default__", tier.limit);
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ Default Limit Set")
            .setDescription(
              `Members with **no special role** are now limited to **${tier.limit} members per \`/djoin\`**.`,
            )
            .setColor(COLOR.green),
        ],
        components: [],
      });
      return;
    }

    await interaction.update({
      embeds: [setRolePickRoleEmbed(tier.label, tier.limit)],
      components: setRolePickRoleComponents(tierValue, tier.limit),
    });
    return;
  }

  if (interaction.isRoleSelectMenu()) {
    const parts = interaction.customId.split(":");
    const tierValue = parts[2] ?? "";
    const limit = parseInt(parts[3] ?? "0", 10);
    const tier = SETROLE_TIERS.find((t) => t.value === tierValue);
    const role = interaction.roles.first();

    if (!role || !tier) return;

    const guildId = interaction.guildId!;
    const existing = getGuildRoleLimits(guildId);
    if (!(role.id in existing) && Object.keys(existing).length >= MAX_ROLES_PER_GUILD) {
      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setTitle("❌ Role Limit Reached")
            .setDescription(`You've reached the maximum of **${MAX_ROLES_PER_GUILD} role limits** per server.`)
            .setColor(COLOR.red),
        ],
        components: [],
      });
      return;
    }

    setGuildRoleLimit(guildId, role.id, limit);
    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setTitle("✅ Role Limit Set")
          .setDescription(
            `<@&${role.id}> has been assigned the **${tier.emoji} ${tier.label}** tier — **${limit} members per \`/djoin\`**.`,
          )
          .setColor(COLOR.green),
      ],
      components: [],
    });
    return;
  }
}
