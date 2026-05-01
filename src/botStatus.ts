export interface BotStatus {
  connected: boolean;
  tag: string | null;
  startedAt: Date;
  connectedAt: Date | null;
  tokenConfigured: boolean;
  clientIdConfigured: boolean;
  clientSecretConfigured: boolean;
}

export const botStatus: BotStatus = {
  connected: false,
  tag: null,
  startedAt: new Date(),
  connectedAt: null,
  tokenConfigured: false,
  clientIdConfigured: false,
  clientSecretConfigured: false,
};
