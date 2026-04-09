import type { Client } from "discord.js";

let _client: Client | null = null;

export function setClient(client: Client) {
  _client = client;
}

export function getClient(): Client | null {
  return _client;
}
