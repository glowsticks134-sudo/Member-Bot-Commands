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
  // ── YOUR CODE GOES HERE ──────────────────────────────────────────────────
  void args;
  void client;

  await message.reply("🔒 secret command executed.");
  // ────────────────────────────────────────────────────────────────────────
}
