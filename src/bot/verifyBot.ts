import {
  Client,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  ApplicationCommandOptionType,
  ChannelType,
  type RESTPostAPIApplicationCommandsJSONBody,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
import { BOT2_TOKEN } from "../config.js";
import { getGuildOwnerRoles } from "../storage/owners.js";
import { isAuthorizedMember } from "./permissions.js";
import * as E from "./embeds.js";

function getClientIdFromToken(token: string): string {
  try {
    return Buffer.from(token.split(".")[0], "base64").toString("utf8");
  } catch {
    return "";
  }
}

let _client: Client | null = null;

export function getVerifyClient(): Client | null {
  return _client;
}

const VERIFY_COMMANDS: RESTPostAPIApplicationCommandsJSONBody[] = [
  {
    name: "send_verify",
    description: "Post the verification embed (owners only)",
    type: 1,
    options: [
      {
        name: "channel",
        description: "Channel to post the embed in (defaults to current channel)",
        type: ApplicationCommandOptionType.Channel,
        required: false,
        channel_types: [ChannelType.GuildText],
      },
      {
        name: "image",
        description: "Image to display in the verification embed",
        type: ApplicationCommandOptionType.Attachment,
        required: false,
      },
    ],
  },
];

async function registerVerifyCommands(clientId: string, guildId: string): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(BOT2_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: VERIFY_COMMANDS });
    console.log(`[bot2] registered ${VERIFY_COMMANDS.length} command(s) for guild ${guildId}`);
  } catch (e) {
    console.error(`[bot2] failed to register commands for guild ${guildId}`, e);
  }
}

async function handleVerifyInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
  if (interaction.commandName !== "send_verify") return;

  const guild = interaction.guild;
  const member = guild ? await guild.members.fetch(interaction.user.id).catch(() => null) : null;
  const guildOwnerId = guild?.ownerId ?? "";
  if (!isAuthorizedMember(guildOwnerId, guild?.id ?? "", interaction.user.id, member)) {
    await interaction.reply({ content: "❌ Only owners can use this command.", ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const channelOpt = interaction.options.getChannel("channel");
  const targetChannelId = channelOpt ? channelOpt.id : interaction.channelId!;
  const imageAttachment = interaction.options.getAttachment("image");
  const imageUrl = imageAttachment?.url ?? null;

  const { embed, components } = E.verifyEmbed(imageUrl);

  try {
    const ch = await interaction.client.channels.fetch(targetChannelId);
    if (ch && "send" in ch) {
      await (ch as TextChannel).send({ embeds: [embed], components });
      await interaction.editReply({ content: `✅ Verification embed posted in <#${targetChannelId}>.` });
    } else {
      await interaction.editReply({ content: "❌ Could not find or send to that channel." });
    }
  } catch (e) {
    await interaction.editReply({ content: `❌ Failed to post embed: ${(e as Error).message}` });
  }
}

export async function startVerifyBot(): Promise<void> {
  if (!BOT2_TOKEN) {
    console.log("[bot2] TOKEN_2 not set — verification bot will not connect");
    return;
  }

  const clientId = getClientIdFromToken(BOT2_TOKEN);
  if (!clientId) {
    console.error("[bot2] could not parse client ID from TOKEN_2 — commands will not register");
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, async (c) => {
    console.log(`[bot2] verification bot ready as ${c.user.tag}`);
    if (clientId) {
      for (const g of c.guilds.cache.values()) {
        await registerVerifyCommands(clientId, g.id);
      }
    }
  });

  client.on(Events.GuildCreate, async (g) => {
    if (clientId) await registerVerifyCommands(clientId, g.id);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    try {
      await handleVerifyInteraction(interaction);
    } catch (e) {
      console.error("[bot2] interaction error", e);
      const reply = { content: `❌ Error: ${(e as Error).message}`, ephemeral: true };
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      } catch { /* noop */ }
    }
  });

  client.on(Events.Error, (e) => console.error("[bot2] error", e));
  await client.login(BOT2_TOKEN);
  _client = client;
}
