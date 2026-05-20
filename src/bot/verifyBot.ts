import {
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  Events,
  REST,
  Routes,
  ApplicationCommandOptionType,
  type RESTPostAPIApplicationCommandsJSONBody,
  type ChatInputCommandInteraction,
} from "discord.js";
import { BOT2_TOKEN } from "../config.js";
import { exchangeCode } from "../oauth.js";
import { saveUserAuth, appendAuthUser, readAuthUsers } from "../storage/tokens.js";
import { doCheckTokens } from "./restock.js";
import * as E from "./embeds.js";
import { COLOR } from "../config.js";

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
  { name: "get_token", description: "Get your OAuth authorization link", type: 1 },
  {
    name: "auth",
    description: "Manually authenticate with an OAuth code",
    type: 1,
    options: [
      {
        name: "code",
        description: "OAuth code from auth link",
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],
  },
  { name: "check_tokens", description: "Validate all stored tokens (owners only)", type: 1 },
];

async function registerVerifyCommands(clientId: string, guildId: string): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(BOT2_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: VERIFY_COMMANDS });
    console.log(`[bot2] registered ${VERIFY_COMMANDS.length} commands for guild ${guildId}`);
  } catch (e) {
    console.error(`[bot2] failed to register commands for guild ${guildId}`, e);
  }
}

async function handleVerifyInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
  const cmd = interaction.commandName;

  switch (cmd) {
    case "get_token":
      await interaction.reply({ embeds: [E.getTokenEmbed(interaction.user.id)], ephemeral: true });
      return;

    case "auth": {
      const code = interaction.options.getString("code", true);
      await interaction.deferReply({ ephemeral: true });
      const res = await exchangeCode(code.trim());
      if (!res.ok) {
        await interaction.followUp({
          content:
            `❌ Auth failed: ${res.error}\n\n**Common causes:**\n` +
            `• Code expired (they last 10 minutes — get a fresh one with \`/get_token\`)\n` +
            `• Code already used (each code works once only)\n` +
            `• Redirect URI mismatch in bot config`,
          ephemeral: true,
        });
        return;
      }
      const { access_token, refresh_token } = res.data;
      saveUserAuth(interaction.user.id, access_token, refresh_token);
      const existing = readAuthUsers();
      if (!existing.some((u) => u.userId === interaction.user.id)) {
        appendAuthUser({ userId: interaction.user.id, accessToken: access_token, refreshToken: refresh_token });
      }
      interaction.user.send({ embeds: [E.authSuccessDmEmbed()] }).catch(() => {});
      await interaction.followUp({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ Authentication Successful")
            .setDescription(
              `<@${interaction.user.id}> has been authenticated and added to stock.\n\n` +
                `Your token is now stored and ready to be used with \`/djoin\`.`,
            )
            .setColor(COLOR.green),
        ],
        ephemeral: true,
      });
      return;
    }

    case "check_tokens": {
      await interaction.deferReply({ ephemeral: true });
      const e = await doCheckTokens();
      await interaction.followUp({ embeds: [e], ephemeral: true });
      return;
    }
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
