import type { GuildMember } from "discord.js";
import { HARDCODED_OWNERS } from "../config.js";
import { getGuildOwnerRoles } from "../storage/owners.js";
import { hasOwnerSession } from "./session.js";

export function isAuthorizedMember(
  guildOwnerId: string,
  guildId: string,
  userId: string,
  member: GuildMember | null,
): boolean {
  if (userId === guildOwnerId) return true;
  if (HARDCODED_OWNERS.includes(userId)) return true;
  if (hasOwnerSession(userId)) return true;
  if (!member) return false;
  const ownerRoles = getGuildOwnerRoles(guildId);
  if (ownerRoles.length === 0) return false;
  for (const role of member.roles.cache.values()) {
    if (ownerRoles.includes(role.id)) return true;
  }
  return false;
}

export function isRealOwner(
  guildOwnerId: string,
  userId: string,
): boolean {
  return userId === guildOwnerId || HARDCODED_OWNERS.includes(userId);
}
