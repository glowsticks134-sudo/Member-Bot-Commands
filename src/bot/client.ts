import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
} from "discord.js";

import { BOT_TOKEN } from "../config.js";
import { dbInit } from "../storage/subscribers.js";
import { handleSlash, registerCommandsForGuild } from "./commands.js";
import { handlePrefix } from "./prefix.js";
import { handleControlPanelButton } from "./controlPanel.js";
import { handleSubscribeButton } from "./subscribeView.js";
import { startLoops } from "./loops.js";
import { attachAutoPing } from "./autoping.js";

export interface LiveMessageRef {
  channelId: string;
  messageId: string;
}

export interface BotState {
  botStartTime: Date | null;
  serverJoinTimes: Map<string, Date>;
  liveMessages: Map<string, LiveMessageRef>;
}

export function makeBot(): { client: Client; state: BotState } {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  const state: BotState = {
    botStartTime: null,
    serverJoinTimes: new Map(),
    liveMessages: new Map(),
  };

  client.once(Events.ClientReady, async (c) => {
    console.log(`[discord] ready as ${c.user.tag}`);
    state.botStartTime = new Date();
    dbInit();
    for (const g of c.guilds.cache.values()) {
      if (!state.serverJoinTimes.has(g.id)) {
        state.serverJoinTimes.set(g.id, new Date());
      }
    }
    for (const g of c.guilds.cache.values()) {
      await registerCommandsForGuild(g.id);
    }
    startLoops(c, state);
  });

  client.on(Events.GuildCreate, async (g) => {
    state.serverJoinTimes.set(g.id, new Date());
    await registerCommandsForGuild(g.id);
  });

  client.on(Events.GuildDelete, (g) => {
    state.serverJoinTimes.delete(g.id);
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleSlash(interaction, state, client);
      } else if (interaction.isButton()) {
        if (interaction.customId.startsWith("cp:")) {
          await handleControlPanelButton(interaction, state);
        } else if (interaction.customId.startsWith("gecko:")) {
          await handleSubscribeButton(interaction);
        }
      }
    } catch (e) {
      console.error("[interaction] error", e);
      const reply = { content: `❌ Error: ${(e as Error).message}`, ephemeral: true };
      try {
        if (interaction.isRepliable()) {
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp(reply);
          } else {
            await interaction.reply(reply);
          }
        }
      } catch {
        /* noop */
      }
    }
  });

  client.on(Events.MessageCreate, (msg) => {
    handlePrefix(msg, client, state).catch((e) =>
      console.error("[prefix] error", e),
    );
  });

  client.on(Events.Error, (e) => console.error("[discord] client error", e));

  attachAutoPing(client);

  return { client, state };
}

export async function startBot(): Promise<{ client: Client; state: BotState }> {
  const { client, state } = makeBot();
  if (!BOT_TOKEN) {
    console.warn("[discord] DISCORD_BOT_TOKEN not set — bot will not connect");
    return { client, state };
  }
  await client.login(BOT_TOKEN);
  return { client, state };
}
