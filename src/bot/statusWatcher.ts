import { ActivityType, Events, type Client } from "discord.js";
import { getStatusRoleConfig } from "../storage/statusRoles.js";

export function attachStatusWatcher(client: Client): void {
  client.on(Events.PresenceUpdate, async (_oldPresence, newPresence) => {
    try {
      const guildId = newPresence.guild?.id;
      if (!guildId) return;

      const cfg = getStatusRoleConfig(guildId);
      if (!cfg) return;

      const { inviteLink, roleId } = cfg;

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
      } else if (!hasLink && alreadyHas) {
        // Only remove if this role was set as the status reward role
        await member.roles.remove(roleId, "Status invite link removed from status");
        console.log(`[statusWatcher] removed role ${roleId} from ${member.user.tag} in ${guildId}`);
      }
    } catch (e) {
      console.error("[statusWatcher] error", e);
    }
  });
}
