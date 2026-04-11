import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Message,
  Attachment,
  ChannelType,
} from "discord.js";
import { logger } from "../lib/logger";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { getValidToken, updateTokenInFile } from "./tokenUtils";
import { setClient } from "./botState";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../../data");
const AUTHS_FILE = path.join(DATA_DIR, "auths.txt");
const OWNERS_FILE = path.join(DATA_DIR, "extra_owners.json");
const ROLE_LIMITS_FILE = path.join(DATA_DIR, "role_limits.json");
const CHANNEL_LOCKS_FILE = path.join(DATA_DIR, "channel_locks.json");
const SCHEDULED_RESTOCKS_FILE = path.join(DATA_DIR, "scheduled_restocks.json");
const DAILY_RESTOCK_FILE = path.join(DATA_DIR, "daily_restock.json");

const BOT_TOKEN = process.env["DISCORD_BOT_TOKEN"]!;
const CLIENT_ID = process.env["DISCORD_CLIENT_ID"]!;
const CLIENT_SECRET = process.env["DISCORD_CLIENT_SECRET"]!;
const REPLIT_DOMAIN = (process.env["REPLIT_DOMAINS"] ?? "").split(",")[0]?.trim();
const REDIRECT_URI =
  process.env["REDIRECT_URI"] ??
  (REPLIT_DOMAIN
    ? `https://${REPLIT_DOMAIN}/api/redirect`
    : `http://localhost:${process.env["PORT"] ?? 8080}/redirect`);
const PREFIX = "!";

const MAX_ROLES_PER_GUILD = 10;

const serverJoinTimes = new Map<string, Date>();
let botStartTime: Date | null = null;
const liveMessages = new Map<"stock" | "status", { channelId: string; messageId: string }>();

// ─── Data dir setup ───────────────────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ─── Auth users ───────────────────────────────────────────────────────────────

export function readAuthUsers(): Array<{ userId: string; accessToken: string; refreshToken: string }> {
  ensureDataDir();
  if (!fs.existsSync(AUTHS_FILE)) return [];
  return fs
    .readFileSync(AUTHS_FILE, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(",");
      if (parts.length >= 3) return { userId: parts[0]!, accessToken: parts[1]!, refreshToken: parts[2]! };
      return null;
    })
    .filter(Boolean) as Array<{ userId: string; accessToken: string; refreshToken: string }>;
}

function saveUserAuth(userId: string, accessToken: string, refreshToken: string) {
  ensureDataDir();
  let lines = fs.existsSync(AUTHS_FILE)
    ? fs.readFileSync(AUTHS_FILE, "utf-8").split("\n").filter(Boolean)
    : [];
  const idx = lines.findIndex((l) => l.startsWith(`${userId},`));
  const entry = `${userId},${accessToken},${refreshToken}`;
  if (idx >= 0) lines[idx] = entry;
  else lines.push(entry);
  fs.writeFileSync(AUTHS_FILE, lines.join("\n") + "\n");
}

export function deleteUserAuth(userId: string) {
  ensureDataDir();
  if (!fs.existsSync(AUTHS_FILE)) return;
  const lines = fs.readFileSync(AUTHS_FILE, "utf-8").split("\n").filter(Boolean).filter((l) => !l.startsWith(`${userId},`));
  fs.writeFileSync(AUTHS_FILE, lines.join("\n") + (lines.length > 0 ? "\n" : ""));
}

// ─── Extra owners ─────────────────────────────────────────────────────────────

export function readExtraOwners(): Record<string, string[]> {
  ensureDataDir();
  if (!fs.existsSync(OWNERS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(OWNERS_FILE, "utf-8")); } catch { return {}; }
}

function writeExtraOwners(data: Record<string, string[]>) {
  ensureDataDir();
  fs.writeFileSync(OWNERS_FILE, JSON.stringify(data, null, 2));
}

export function getGuildExtraOwners(guildId: string): string[] {
  return readExtraOwners()[guildId] ?? [];
}

export function isExtraOwner(guildId: string, userId: string): boolean {
  return getGuildExtraOwners(guildId).includes(userId);
}

export function addExtraOwner(guildId: string, userId: string) {
  const data = readExtraOwners();
  if (!data[guildId]) data[guildId] = [];
  if (!data[guildId]!.includes(userId)) data[guildId]!.push(userId);
  writeExtraOwners(data);
}

export function removeExtraOwner(guildId: string, userId: string) {
  const data = readExtraOwners();
  if (!data[guildId]) return;
  data[guildId] = data[guildId]!.filter((id) => id !== userId);
  writeExtraOwners(data);
}

function isAuthorizedUser(guildOwnerId: string, guildId: string, userId: string): boolean {
  return userId === guildOwnerId || isExtraOwner(guildId, userId);
}

// ─── Role limits (file-backed, per guild, max 10) ─────────────────────────────

export function readRoleLimits(): Record<string, Record<string, number>> {
  ensureDataDir();
  if (!fs.existsSync(ROLE_LIMITS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(ROLE_LIMITS_FILE, "utf-8")); } catch { return {}; }
}

function writeRoleLimits(data: Record<string, Record<string, number>>) {
  ensureDataDir();
  fs.writeFileSync(ROLE_LIMITS_FILE, JSON.stringify(data, null, 2));
}

export function getGuildRoleLimits(guildId: string): Record<string, number> {
  return readRoleLimits()[guildId] ?? {};
}

export function setGuildRoleLimit(guildId: string, roleId: string, limit: number): { ok: boolean; error?: string } {
  const data = readRoleLimits();
  if (!data[guildId]) data[guildId] = {};
  const guildRoles = data[guildId]!;
  if (!guildRoles[roleId] && Object.keys(guildRoles).length >= MAX_ROLES_PER_GUILD) {
    return { ok: false, error: `Maximum of ${MAX_ROLES_PER_GUILD} roles per server reached. Remove one first.` };
  }
  guildRoles[roleId] = limit;
  writeRoleLimits(data);
  return { ok: true };
}

export function removeGuildRoleLimit(guildId: string, roleId: string): boolean {
  const data = readRoleLimits();
  if (!data[guildId] || !data[guildId]![roleId]) return false;
  delete data[guildId]![roleId];
  writeRoleLimits(data);
  return true;
}

function getRoleLimit(guildId: string, roleIds: string[]): number | null {
  const limits = getGuildRoleLimits(guildId);
  let best: number | null = null;
  for (const roleId of roleIds) {
    const limit = limits[roleId];
    if (limit !== undefined && (best === null || limit > best)) best = limit;
  }
  return best;
}

// ─── Channel locks (file-backed, per guild) ───────────────────────────────────

type ChannelLockType = "djoin" | "auth";

export function readChannelLocks(): Record<string, Partial<Record<ChannelLockType, string>>> {
  ensureDataDir();
  if (!fs.existsSync(CHANNEL_LOCKS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(CHANNEL_LOCKS_FILE, "utf-8")); } catch { return {}; }
}

function writeChannelLocks(data: Record<string, Partial<Record<ChannelLockType, string>>>) {
  ensureDataDir();
  fs.writeFileSync(CHANNEL_LOCKS_FILE, JSON.stringify(data, null, 2));
}

export function getChannelLock(guildId: string, type: ChannelLockType): string | null {
  return readChannelLocks()[guildId]?.[type] ?? null;
}

export function setChannelLock(guildId: string, type: ChannelLockType, channelId: string) {
  const data = readChannelLocks();
  if (!data[guildId]) data[guildId] = {};
  data[guildId]![type] = channelId;
  writeChannelLocks(data);
}

export function clearChannelLock(guildId: string, type: ChannelLockType): boolean {
  const data = readChannelLocks();
  if (!data[guildId] || !data[guildId]![type]) return false;
  delete data[guildId]![type];
  writeChannelLocks(data);
  return true;
}

// ─── Scheduled restocks ───────────────────────────────────────────────────────

type ScheduledRestock = {
  id: string;
  runAt: number;
  rawTokens: string;
  channelId: string;
  guildId: string;
  createdBy: string;
};

function readScheduledRestocks(): ScheduledRestock[] {
  ensureDataDir();
  if (!fs.existsSync(SCHEDULED_RESTOCKS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(SCHEDULED_RESTOCKS_FILE, "utf-8")); } catch { return []; }
}

function writeScheduledRestocks(data: ScheduledRestock[]) {
  ensureDataDir();
  fs.writeFileSync(SCHEDULED_RESTOCKS_FILE, JSON.stringify(data, null, 2));
}

function addScheduledRestock(entry: ScheduledRestock) {
  const data = readScheduledRestocks();
  data.push(entry);
  writeScheduledRestocks(data);
}

function removeScheduledRestock(id: string): boolean {
  const data = readScheduledRestocks();
  const next = data.filter((e) => e.id !== id);
  if (next.length === data.length) return false;
  writeScheduledRestocks(next);
  return true;
}

function parseDuration(input: string): number | null {
  const clean = input.trim().toLowerCase();
  const full = clean.match(/^(?:(\d+)h)?(?:(\d+)m)?$/);
  if (full && (full[1] || full[2])) {
    const hours = parseInt(full[1] ?? "0", 10);
    const minutes = parseInt(full[2] ?? "0", 10);
    return (hours * 60 + minutes) * 60_000;
  }
  const minsOnly = clean.match(/^(\d+)$/);
  if (minsOnly) return parseInt(minsOnly[1]!, 10) * 60_000;
  return null;
}

function formatDuration(ms: number): string {
  const totalMins = Math.floor(ms / 60_000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

// ─── Daily restock ────────────────────────────────────────────────────────────

type DailyRestock = {
  time: string;
  rawTokens: string;
  channelId: string;
  guildId: string;
  createdBy: string;
  lastRanDate: string | null;
};

function readDailyRestock(): DailyRestock | null {
  ensureDataDir();
  if (!fs.existsSync(DAILY_RESTOCK_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(DAILY_RESTOCK_FILE, "utf-8")); } catch { return null; }
}

function writeDailyRestock(data: DailyRestock | null) {
  ensureDataDir();
  if (data === null) { if (fs.existsSync(DAILY_RESTOCK_FILE)) fs.unlinkSync(DAILY_RESTOCK_FILE); return; }
  fs.writeFileSync(DAILY_RESTOCK_FILE, JSON.stringify(data, null, 2));
}

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Channel enforcement helper ────────────────────────────────────────────────

function checkChannelLock(guildId: string, type: ChannelLockType, channelId: string): string | null {
  const locked = getChannelLock(guildId, type);
  if (locked && channelId !== locked) return locked;
  return null;
}

// ─── Slash command definitions ────────────────────────────────────────────────

const slashCommands = [
  new SlashCommandBuilder().setName("help").setDescription("Show all available bot commands"),
  new SlashCommandBuilder().setName("get_token").setDescription("Get the authentication link"),
  new SlashCommandBuilder()
    .setName("auth")
    .setDescription("Authenticate using your OAuth2 code")
    .addStringOption((o) => o.setName("code").setDescription("The authorization code").setRequired(true)),
  new SlashCommandBuilder().setName("count").setDescription("Show number of stored tokens"),
  new SlashCommandBuilder().setName("check_tokens").setDescription("Validate all stored tokens"),
  new SlashCommandBuilder().setName("list_users").setDescription("List all authenticated user IDs"),
  new SlashCommandBuilder()
    .setName("djoin")
    .setDescription("Add all authenticated users to a server")
    .addStringOption((o) => o.setName("server_id").setDescription("Target server ID").setRequired(true)),
  new SlashCommandBuilder().setName("servers").setDescription("List all servers the bot is in"),
  new SlashCommandBuilder()
    .setName("server_age")
    .setDescription("Check how long the bot has been in a server")
    .addStringOption((o) => o.setName("server_id").setDescription("Server ID (blank = all)").setRequired(false)),
  new SlashCommandBuilder().setName("invite").setDescription("Get the bot invite link"),
  new SlashCommandBuilder().setName("add").setDescription("Get a stylish embed to add this bot to a server"),
  new SlashCommandBuilder()
    .setName("restock")
    .setDescription("(Owner only) Add member tokens to storage")
    .addAttachmentOption((o) => o.setName("file").setDescription("Upload a .txt tokens file").setRequired(false))
    .addStringOption((o) => o.setName("tokens").setDescription("Paste tokens directly (userId,access,refresh per line)").setRequired(false)),
  new SlashCommandBuilder()
    .setName("addowner")
    .setDescription("(Server owner only) Grant a user owner-level access")
    .addUserOption((o) => o.setName("user").setDescription("User to grant access").setRequired(true)),
  new SlashCommandBuilder()
    .setName("removeowner")
    .setDescription("(Server owner only) Revoke owner-level access from a user")
    .addUserOption((o) => o.setName("user").setDescription("User to revoke").setRequired(true)),
  new SlashCommandBuilder().setName("owners").setDescription("List all users with owner access"),
  new SlashCommandBuilder().setName("restart").setDescription("(Owner only) Restart the bot to apply command updates"),
  // Role limit commands
  new SlashCommandBuilder()
    .setName("setrole")
    .setDescription("(Owner only) Set how many members a role can djoin (max 10 roles)")
    .addRoleOption((o) => o.setName("role").setDescription("The role to configure").setRequired(true))
    .addIntegerOption((o) => o.setName("limit").setDescription("Max members this role can djoin (1–50000)").setRequired(true).setMinValue(1).setMaxValue(50000)),
  new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("(Owner only) Remove a role's djoin limit")
    .addRoleOption((o) => o.setName("role").setDescription("The role to remove").setRequired(true)),
  new SlashCommandBuilder().setName("listroles").setDescription("List all configured role djoin limits for this server"),
  // Channel lock commands
  new SlashCommandBuilder()
    .setName("setchannel")
    .setDescription("(Owner only) Lock a command to a specific channel")
    .addStringOption((o) =>
      o.setName("type").setDescription("Which command to lock").setRequired(true)
        .addChoices({ name: "djoin", value: "djoin" }, { name: "auth", value: "auth" })
    )
    .addChannelOption((o) =>
      o.setName("channel").setDescription("The channel to lock to").setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    ),
  new SlashCommandBuilder()
    .setName("clearchannel")
    .setDescription("(Owner only) Remove a command's channel lock")
    .addStringOption((o) =>
      o.setName("type").setDescription("Which lock to clear").setRequired(true)
        .addChoices({ name: "djoin", value: "djoin" }, { name: "auth", value: "auth" })
    ),
  new SlashCommandBuilder().setName("listchannels").setDescription("List all channel locks for this server"),
  new SlashCommandBuilder().setName("dashboard").setDescription("(Owner only) Get a private link to the owner dashboard"),
  new SlashCommandBuilder().setName("cleanup_servers").setDescription("(Owner only) Leave all servers the bot is currently in"),
  new SlashCommandBuilder().setName("clear_stock").setDescription("(Owner only) Remove all stored tokens"),
  new SlashCommandBuilder()
    .setName("schedule_restock")
    .setDescription("(Owner only) Schedule a restock to run after a delay")
    .addStringOption((o) => o.setName("time").setDescription("Delay before restock runs (e.g. 1h, 30m, 1h30m)").setRequired(true))
    .addAttachmentOption((o) => o.setName("file").setDescription("Upload a .txt tokens file").setRequired(false))
    .addStringOption((o) => o.setName("tokens").setDescription("Paste tokens directly (userId,access,refresh per line)").setRequired(false)),
  new SlashCommandBuilder().setName("list_schedules").setDescription("(Owner only) List all pending scheduled restocks"),
  new SlashCommandBuilder()
    .setName("cancel_schedule")
    .setDescription("(Owner only) Cancel a scheduled restock by ID")
    .addStringOption((o) => o.setName("id").setDescription("Schedule ID to cancel").setRequired(true)),
  new SlashCommandBuilder()
    .setName("set_daily_restock")
    .setDescription("(Owner only) Set a daily restock that runs at the same time every day")
    .addStringOption((o) => o.setName("time").setDescription("Time to run daily in 24h format (e.g. 14:00)").setRequired(true))
    .addAttachmentOption((o) => o.setName("file").setDescription("Upload a .txt tokens file").setRequired(false))
    .addStringOption((o) => o.setName("tokens").setDescription("Paste tokens directly (userId,access,refresh per line)").setRequired(false)),
  new SlashCommandBuilder().setName("cancel_daily_restock").setDescription("(Owner only) Cancel the daily restock"),
  new SlashCommandBuilder().setName("daily_restock_status").setDescription("(Owner only) Show the current daily restock configuration"),
  new SlashCommandBuilder()
    .setName("edit_daily_restock")
    .setDescription("(Owner only) Edit the time and/or tokens for the daily restock")
    .addStringOption((o) => o.setName("time").setDescription("New time in MST 24h format (e.g. 14:00) — leave blank to keep current").setRequired(false))
    .addAttachmentOption((o) => o.setName("file").setDescription("New tokens file — leave blank to keep current").setRequired(false))
    .addStringOption((o) => o.setName("tokens").setDescription("New pasted tokens — leave blank to keep current").setRequired(false)),
  new SlashCommandBuilder().setName("stock").setDescription("Show the current number of stored tokens"),
  new SlashCommandBuilder().setName("status").setDescription("Show the bot's current online status and stats"),
].map((c) => c.toJSON());

async function registerCommands(guildIds: string[] = []) {
  const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
    logger.info("Cleared global slash commands");
    for (const guildId of guildIds) {
      try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body: slashCommands });
        logger.info({ guildId }, "Guild slash commands registered");
      } catch (err) {
        logger.warn({ err, guildId }, "Failed to register guild commands");
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to register commands");
  }
}

// ─── Embed builders ───────────────────────────────────────────────────────────

function buildHelpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🤖 Members Bot — All Commands")
    .setColor(0x5865f2)
    .addFields(
      {
        name: "🔐 Authentication",
        value:
          "`/get_token` or `!get_token` — Get auth link\n" +
          "`/auth code:CODE` or `!auth CODE` — Authenticate\n" +
          "`/check_tokens` or `!check_tokens` — Validate tokens",
        inline: false,
      },
      {
        name: "🚀 Mass Joining",
        value:
          "`/djoin server_id:ID` or `!djoin ID` — Add all users to server\n" +
          "`/servers` or `!servers` — List bot servers\n" +
          "`/server_age` or `!server_age [ID]` — Check server age",
        inline: false,
      },
      {
        name: "👥 User Management",
        value:
          "`/count` or `!count` — Stored token count\n" +
          "`/list_users` or `!list_users` — List authenticated users\n" +
          "`/restock` or `!restock` — Add bulk tokens (owners only)\n" +
          "`/clear_stock` or `!clear_stock` — Remove all stored tokens (owners only)\n" +
          "`/schedule_restock time:1h` or `!schedule_restock 1h` — Schedule a restock (owners only)\n" +
          "`/list_schedules` or `!list_schedules` — View pending schedules (owners only)\n" +
          "`/cancel_schedule id:ID` or `!cancel_schedule ID` — Cancel a schedule (owners only)\n" +
          "`/set_daily_restock time:14:00` or `!set_daily_restock 14:00` — Set a daily restock (owners only)\n" +
          "`/cancel_daily_restock` or `!cancel_daily_restock` — Cancel the daily restock (owners only)\n" +
          "`/edit_daily_restock` or `!edit_daily_restock` — Edit the daily restock time/tokens (owners only)\n" +
          "`/daily_restock_status` or `!daily_restock_status` — Show daily restock config (owners only)",
        inline: false,
      },
      {
        name: "👑 Owner Management",
        value:
          "`/addowner @user` or `!addowner @user` — Add extra owner\n" +
          "`/removeowner @user` or `!removeowner @user` — Remove extra owner\n" +
          "`/owners` or `!owners` — List all owners\n" +
          "`/restart` or `!restart` — Restart bot\n" +
          "`/dashboard` or `!dashboard` — Get private dashboard link (owners only)",
        inline: false,
      },
      {
        name: "🎭 Role Limits (up to 10 roles)",
        value:
          "`/setrole role:@Role limit:N` or `!setrole ROLE_ID N` — Set role djoin limit\n" +
          "`/removerole role:@Role` or `!removerole ROLE_ID` — Remove role limit\n" +
          "`/listroles` or `!listroles` — List all role limits",
        inline: false,
      },
      {
        name: "📌 Channel Locks",
        value:
          "`/setchannel type:djoin channel:#ch` or `!setchannel djoin CHANNEL_ID` — Lock djoin to channel\n" +
          "`/setchannel type:auth channel:#ch` or `!setchannel auth CHANNEL_ID` — Lock auth to channel\n" +
          "`/clearchannel type:djoin` or `!clearchannel djoin` — Remove lock\n" +
          "`/listchannels` or `!listchannels` — Show channel locks",
        inline: false,
      },
      {
        name: "🔧 Utility",
        value:
          "`/invite` or `!invite` — Bot invite link\n" +
          "`/add` or `!add` — Add bot embed\n" +
          "`/stock` or `!stock` — Show current token stock\n" +
          "`/status` or `!status` — Show bot online status & stats\n" +
          "`/cleanup_servers` or `!cleanup_servers` — Leave all servers (owners only)\n" +
          "`/help` or `!help` — Show this message",
        inline: false,
      },
      {
        name: "⚠️ Notes",
        value: "• Bot auto-leaves servers after 14 days\n• Both `/` slash commands and `!` prefix commands work\n• Role limit commands: owner only",
        inline: false,
      }
    )
    .setTimestamp();
}

function buildGetTokenEmbed(): EmbedBuilder {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: "identify guilds.join",
    prompt: "consent",
  });
  const oauthUrl = `https://discord.com/oauth2/authorize?${params.toString()}`;
  return new EmbedBuilder()
    .setTitle("🔐 Authentication Required")
    .setDescription("Click the link below to authorize your account.")
    .setColor(0x5865f2)
    .addFields(
      { name: "🚨 Important", value: "Codes expire in **10 minutes** — act fast!", inline: false },
      { name: "🔗 Auth Link", value: `[👉 Click Here to Authenticate 👈](${oauthUrl})`, inline: false },
      {
        name: "📝 Steps",
        value: "1. Click the link\n2. Authorize the app\n3. Copy the code\n4. Use `/auth code:CODE` or `!auth CODE`",
        inline: false,
      }
    )
    .setTimestamp();
}

async function doAuthExchange(
  code: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const tokenData = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    });
    const res = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenData.toString(),
    });
    if (!res.ok) {
      const err = (await res.json()) as { error_description?: string };
      return { ok: false, error: err.error_description ?? "Unknown error" };
    }
    const info = (await res.json()) as { access_token: string; refresh_token: string };
    saveUserAuth(userId, info.access_token, info.refresh_token);
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error during authentication" };
  }
}

function buildCountEmbed(): EmbedBuilder {
  const users = readAuthUsers();
  return new EmbedBuilder()
    .setTitle("📊 Stored Tokens")
    .setDescription(`There are currently **${users.length}** authenticated tokens stored.`)
    .setColor(0x5865f2)
    .setTimestamp();
}

function buildListUsersEmbed(): { embed: EmbedBuilder; empty: boolean } {
  const users = readAuthUsers();
  if (users.length === 0) return { embed: new EmbedBuilder().setDescription("❌ No authenticated users found.").setColor(0xed4245), empty: true };
  let desc = "";
  for (const u of users) {
    const line = `• <@${u.userId}> (\`${u.userId}\`)\n`;
    if (desc.length + line.length > 3900) { desc += `…and more`; break; }
    desc += line;
  }
  return {
    embed: new EmbedBuilder()
      .setTitle(`👥 Authenticated Users (${users.length})`)
      .setDescription(desc)
      .setColor(0x5865f2)
      .setTimestamp(),
    empty: false,
  };
}

export async function doCheckTokens(): Promise<EmbedBuilder> {
  const users = readAuthUsers();
  if (users.length === 0) {
    return new EmbedBuilder().setDescription("❌ No tokens stored.").setColor(0xed4245);
  }
  let valid = 0, refreshed = 0, invalid = 0;
  for (const u of users) {
    const result = await getValidToken(u.userId, u.accessToken, u.refreshToken, CLIENT_ID, CLIENT_SECRET);
    if (result === null) { invalid++; }
    else if (result !== u.accessToken) { refreshed++; valid++; updateTokenInFile(AUTHS_FILE, u.userId, result, u.refreshToken); }
    else { valid++; }
  }
  return new EmbedBuilder()
    .setTitle("🔍 Token Validation Results")
    .setColor(0x5865f2)
    .addFields(
      { name: "✅ Valid", value: `${valid}`, inline: true },
      { name: "🔄 Refreshed", value: `${refreshed}`, inline: true },
      { name: "❌ Invalid", value: `${invalid}`, inline: true },
      { name: "📊 Total", value: `${users.length}`, inline: true }
    )
    .setTimestamp();
}

export async function doMassJoin(
  targetServerId: string,
  client: Client,
  onProgress: (msg: string) => Promise<void>,
  limit?: number
): Promise<EmbedBuilder | null> {
  const targetGuild = client.guilds.cache.get(targetServerId);
  if (!targetGuild) {
    const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands`;
    return new EmbedBuilder()
      .setTitle("❌ Bot Not In Server")
      .setDescription(`Bot is not in server \`${targetServerId}\``)
      .setColor(0xed4245)
      .addFields({ name: "🚨 Solution", value: `**[Add bot to server first](${inviteUrl})**\nThen run the djoin command again`, inline: false });
  }
  const allUsers = readAuthUsers();
  if (allUsers.length === 0) {
    return new EmbedBuilder().setDescription("❌ No authenticated users. Share `!get_token` or `/get_token` with users first.").setColor(0xed4245);
  }

  const users = limit !== undefined ? allUsers.slice(0, limit) : allUsers;
  const total = users.length;
  const capNote = limit !== undefined ? ` (capped at ${limit} by your role)` : "";

  await onProgress(`🚀 **Mass Join Started** — Adding **${total}** users to **${targetGuild.name}**${capNote}...`);
  let success = 0, failed = 0, tokenRefreshed = 0;
  for (let i = 0; i < users.length; i++) {
    const u = users[i]!;
    if (i % 10 === 0) {
      await onProgress(`🚀 **Mass Join In Progress** — ${i + 1}/${total}${capNote}\n✅ Added: ${success} | ❌ Failed: ${failed} | 🔄 Refreshed: ${tokenRefreshed}`);
    }
    const validToken = await getValidToken(u.userId, u.accessToken, u.refreshToken, CLIENT_ID, CLIENT_SECRET);
    if (!validToken) { failed++; continue; }
    if (validToken !== u.accessToken) { tokenRefreshed++; updateTokenInFile(AUTHS_FILE, u.userId, validToken, u.refreshToken); }
    try {
      const res = await fetch(`https://discord.com/api/v10/guilds/${targetServerId}/members/${u.userId}`, {
        method: "PUT",
        headers: { Authorization: `Bot ${BOT_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: validToken }),
      });
      if (res.status === 201 || res.status === 204) success++;
      else { failed++; logger.warn({ userId: u.userId, status: res.status }, "Failed to add member"); }
    } catch (err) {
      failed++;
      logger.error({ err, userId: u.userId }, "Error adding member");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return new EmbedBuilder()
    .setTitle("✅ Mass Join Complete")
    .setDescription(`Finished adding users to **${targetGuild.name}**${capNote}`)
    .setColor(0x57f287)
    .addFields(
      { name: "✅ Successfully Added", value: `${success}`, inline: true },
      { name: "❌ Failed", value: `${failed}`, inline: true },
      { name: "🔄 Tokens Refreshed", value: `${tokenRefreshed}`, inline: true },
      { name: "📊 Total Processed", value: `${total}`, inline: true },
      ...(limit !== undefined ? [{ name: "🎭 Role Limit", value: `${limit} members`, inline: true }] : [])
    )
    .setTimestamp();
}

function buildServersEmbed(client: Client): EmbedBuilder {
  const guilds = [...client.guilds.cache.values()];
  if (guilds.length === 0) return new EmbedBuilder().setDescription("❌ Bot is not in any servers.").setColor(0xed4245);
  const lines = guilds.map((g) => {
    const joinedAt = serverJoinTimes.get(g.id);
    const age = joinedAt ? `${Math.floor((Date.now() - joinedAt.getTime()) / 86400000)}d` : "?";
    return `• **${g.name}** (\`${g.id}\`) — ${g.memberCount} members — ${age} ago`;
  });
  return new EmbedBuilder()
    .setTitle(`🌐 Servers (${guilds.length})`)
    .setDescription(lines.slice(0, 20).join("\n") + (lines.length > 20 ? `\n…and ${lines.length - 20} more` : ""))
    .setColor(0x5865f2)
    .setTimestamp();
}

function buildServerAgeEmbed(serverId: string | null, client: Client): EmbedBuilder {
  if (serverId) {
    const guild = client.guilds.cache.get(serverId);
    if (!guild) return new EmbedBuilder().setDescription(`❌ Bot is not in server \`${serverId}\`.`).setColor(0xed4245);
    const joinedAt = serverJoinTimes.get(serverId);
    const days = joinedAt ? Math.floor((Date.now() - joinedAt.getTime()) / 86400000) : null;
    return new EmbedBuilder()
      .setTitle(`📅 Server Age: ${guild.name}`)
      .setDescription(days !== null ? `Bot has been in this server for **${days} day(s)**.` : "Join time unknown.")
      .setColor(days !== null && days >= 14 ? 0xed4245 : 0x57f287)
      .addFields(
        { name: "Server ID", value: `\`${guild.id}\``, inline: true },
        { name: "Members", value: `${guild.memberCount}`, inline: true },
        { name: "Days", value: days !== null ? `${days}` : "?", inline: true },
        { name: "Status", value: days !== null && days >= 14 ? "⚠️ Will leave soon" : "✅ OK", inline: true }
      )
      .setTimestamp();
  }
  const guilds = [...client.guilds.cache.values()];
  const lines = guilds.map((g) => {
    const joinedAt = serverJoinTimes.get(g.id);
    const days = joinedAt ? Math.floor((Date.now() - joinedAt.getTime()) / 86400000) : "?";
    const flag = typeof days === "number" && days >= 14 ? "⚠️" : "✅";
    return `${flag} **${g.name}** — ${days}d`;
  });
  return new EmbedBuilder()
    .setTitle("📅 Server Ages")
    .setDescription(lines.join("\n") || "No servers found.")
    .setColor(0x5865f2)
    .setTimestamp();
}

function buildInviteEmbed(): EmbedBuilder {
  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands`;
  return new EmbedBuilder()
    .setTitle("🔗 Bot Invite Link")
    .setDescription(`[👉 Click here to invite the bot](${inviteUrl})`)
    .setColor(0x5865f2)
    .setTimestamp();
}

function buildAddEmbed(client: Client): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands`;
  const embed = new EmbedBuilder()
    .setTitle("➕ Add Members Bot to Your Server")
    .setDescription(
      "Click the button below to invite **Members Bot** to your Discord server.\n\n" +
      "**What this bot does:**\n" +
      "• Backup & restore server members via OAuth2\n" +
      "• Mass-join authenticated users into any server\n" +
      "• Auto token refresh & validation\n" +
      "• Both `/` slash commands and `!` prefix commands"
    )
    .setColor(0x5865f2)
    .setThumbnail(client.user?.displayAvatarURL() ?? null)
    .addFields(
      { name: "⚡ Permissions", value: "Administrator (required for guild member management)", inline: false },
      { name: "📋 Commands", value: "22 commands — slash & prefix", inline: true },
      { name: "🔒 OAuth2 Scopes", value: "`bot` + `applications.commands`", inline: true }
    )
    .setFooter({ text: "Members Bot • Invite & start collecting tokens right away" })
    .setTimestamp();
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setLabel("➕ Add to Server").setStyle(ButtonStyle.Link).setURL(inviteUrl),
    new ButtonBuilder().setLabel("📖 How to Use").setStyle(ButtonStyle.Link).setURL("https://discord.com/channels/@me")
  );
  return { embed, row };
}

export async function doRestock(rawText: string): Promise<EmbedBuilder> {
  const lines = rawText.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  let added = 0, updated = 0, invalid = 0;

  const existingLines = fs.existsSync(AUTHS_FILE)
    ? fs.readFileSync(AUTHS_FILE, "utf-8").split("\n").filter(Boolean)
    : [];
  const existingMap = new Map<string, string>();
  for (const line of existingLines) {
    const userId = line.split(",")[0];
    if (userId) existingMap.set(userId, line);
  }

  for (const line of lines) {
    const parts = line.split(",");
    if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) { invalid++; continue; }
    const [userId, accessToken, refreshToken] = parts as [string, string, string];
    const entry = `${userId},${accessToken},${refreshToken}`;
    if (existingMap.has(userId)) {
      existingMap.set(userId, entry);
      updated++;
    } else {
      existingMap.set(userId, entry);
      added++;
    }
  }

  fs.writeFileSync(AUTHS_FILE, [...existingMap.values()].join("\n") + "\n");
  const total = existingMap.size;

  return new EmbedBuilder()
    .setTitle("🔄 Restock Complete")
    .setColor(added > 0 || updated > 0 ? 0x57f287 : 0xfaa61a)
    .addFields(
      { name: "✅ Added", value: `${added}`, inline: true },
      { name: "🔄 Updated", value: `${updated}`, inline: true },
      { name: "❌ Invalid", value: `${invalid}`, inline: true },
      { name: "📦 Total Stored", value: `${total}`, inline: true }
    )
    .setFooter({ text: "Use /djoin or !djoin to push members to a server" })
    .setTimestamp();
}

function buildOwnersEmbed(guildOwnerId: string, guildId: string): EmbedBuilder {
  const extras = getGuildExtraOwners(guildId);
  const lines = [`👑 <@${guildOwnerId}> — **Server Owner** (permanent)`];
  if (extras.length > 0) extras.forEach((id) => lines.push(`⭐ <@${id}> — Extra Owner`));
  else lines.push("\n*No extra owners yet.*\nUse `/addowner` or `!addowner @user` to grant access.");
  return new EmbedBuilder()
    .setTitle("👑 Owner Access List")
    .setDescription(lines.join("\n"))
    .setColor(0x5865f2)
    .setFooter({ text: `${extras.length} extra owner(s) • Use addowner / removeowner to manage` })
    .setTimestamp();
}

function buildRoleLimitsEmbed(guildId: string): EmbedBuilder {
  const limits = getGuildRoleLimits(guildId);
  const entries = Object.entries(limits);
  if (entries.length === 0) {
    return new EmbedBuilder()
      .setTitle("🎭 Role djoin Limits")
      .setDescription("No role limits configured.\nUse `/setrole` or `!setrole ROLE_ID LIMIT` to add one.")
      .setColor(0xfaa61a)
      .setTimestamp();
  }
  const lines = entries.map(([roleId, limit]) => `• <@&${roleId}> — **${limit}** members`);
  return new EmbedBuilder()
    .setTitle(`🎭 Role djoin Limits (${entries.length}/${MAX_ROLES_PER_GUILD})`)
    .setDescription(lines.join("\n"))
    .setColor(0x5865f2)
    .setFooter({ text: `Max ${MAX_ROLES_PER_GUILD} roles per server` })
    .setTimestamp();
}

function buildChannelLocksEmbed(guildId: string): EmbedBuilder {
  const locks = readChannelLocks()[guildId] ?? {};
  const djoinCh = locks.djoin;
  const authCh = locks.auth;
  if (!djoinCh && !authCh) {
    return new EmbedBuilder()
      .setTitle("📌 Channel Locks")
      .setDescription("No channel locks set.\nUse `/setchannel` to restrict commands to specific channels.")
      .setColor(0xfaa61a)
      .setTimestamp();
  }
  return new EmbedBuilder()
    .setTitle("📌 Channel Locks")
    .setColor(0x5865f2)
    .addFields(
      { name: "🚀 djoin", value: djoinCh ? `<#${djoinCh}>` : "Not locked", inline: true },
      { name: "🔐 auth", value: authCh ? `<#${authCh}>` : "Not locked", inline: true }
    )
    .setTimestamp();
}

// ─── Reusable deny embeds ─────────────────────────────────────────────────────

function denyEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("❌ Access Denied")
    .setDescription("Only the **server owner** or an **extra owner** can use this command.")
    .setColor(0xed4245);
}

function denyRealOwnerEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("❌ Access Denied")
    .setDescription("Only the **real server owner** can use this command.")
    .setColor(0xed4245);
}

function noTokensEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("⚠️ No Tokens Provided")
    .setDescription(
      "You must provide tokens to restock.\n\n" +
      "**Slash command:** Use the `file` or `tokens` option\n" +
      "**Prefix command:** Attach a `.txt` file OR paste tokens after `!restock`\n\n" +
      "**Token format (one per line):**\n```userId,accessToken,refreshToken```"
    )
    .setColor(0xfaa61a);
}

function notAuthedEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("🔐 Not Authenticated")
    .setDescription(
      "You must authenticate before you can use `/djoin` or `!djoin`.\n\n" +
      "**How to authenticate:**\n" +
      "1. Run `/get_token` or `!get_token` to get your auth link\n" +
      "2. Click the link and authorize the app\n" +
      "3. Copy the code and run `/auth code:YOUR_CODE`\n\n" +
      "Once authenticated, you can use djoin."
    )
    .setColor(0xed4245);
}

function channelLockedEmbed(channelId: string, cmd: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle("📌 Wrong Channel")
    .setDescription(`The \`${cmd}\` command is locked to <#${channelId}>.\n\nPlease use it there.`)
    .setColor(0xfaa61a);
}

function buildDashboardEmbed(): EmbedBuilder {
  const dashboardUrl = REPLIT_DOMAIN
    ? `https://${REPLIT_DOMAIN}/dashboard/`
    : "http://localhost:3000/dashboard/";
  return new EmbedBuilder()
    .setTitle("🖥️ Owner Dashboard")
    .setDescription(
      `Here is your private link to the **Members Bot Dashboard**.\n\n` +
      `[👉 Open Dashboard](${dashboardUrl})\n\n` +
      `**What you can do:**\n` +
      `• View bot stats and connected servers\n` +
      `• Manage stored OAuth2 tokens\n` +
      `• Run and monitor mass joins\n` +
      `• Configure role limits and channel locks\n` +
      `• Manage extra owners\n\n` +
      `⚠️ **Keep this link private.** Sign in using your bot token.`
    )
    .setColor(0x5865f2)
    .setURL(dashboardUrl)
    .setFooter({ text: "Only visible to you • Dashboard sessions last 8 hours" })
    .setTimestamp();
}

function buildDailyRestockStatusEmbed(): EmbedBuilder {
  const config = readDailyRestock();
  if (!config) {
    return new EmbedBuilder()
      .setTitle("📅 Daily Restock")
      .setDescription("No daily restock configured.\nUse `/set_daily_restock` to set one up.")
      .setColor(0xfaa61a)
      .setTimestamp();
  }
  const tokenCount = config.rawTokens.split(/[\r\n]+/).filter(Boolean).length;
  const lastRan = config.lastRanDate ?? "Never";
  const today = getTodayDateString();
  const ranToday = config.lastRanDate === today;
  return new EmbedBuilder()
    .setTitle("📅 Daily Restock Active")
    .setColor(0x5865f2)
    .addFields(
      { name: "⏰ Time (MST)", value: config.time, inline: true },
      { name: "📦 Tokens", value: `${tokenCount}`, inline: true },
      { name: "✅ Ran Today", value: ranToday ? "Yes" : "No", inline: true },
      { name: "📆 Last Ran", value: lastRan, inline: true },
      { name: "👤 Set By", value: `<@${config.createdBy}>`, inline: true },
    )
    .setFooter({ text: "Use /cancel_daily_restock to remove" })
    .setTimestamp();
}

function buildListSchedulesEmbed(): EmbedBuilder {
  const schedules = readScheduledRestocks();
  if (schedules.length === 0) {
    return new EmbedBuilder()
      .setTitle("📅 Scheduled Restocks")
      .setDescription("No pending scheduled restocks.\nUse `/schedule_restock` to add one.")
      .setColor(0xfaa61a)
      .setTimestamp();
  }
  const lines = schedules.map((s) => {
    const remaining = s.runAt - Date.now();
    const timeStr = remaining > 0 ? `in ${formatDuration(remaining)}` : "running soon...";
    const tokenCount = s.rawTokens.split(/[\r\n]+/).filter(Boolean).length;
    return `• \`${s.id}\` — **${tokenCount} tokens** — ${timeStr} — <@${s.createdBy}>`;
  });
  return new EmbedBuilder()
    .setTitle(`📅 Scheduled Restocks (${schedules.length})`)
    .setDescription(lines.join("\n"))
    .setColor(0x5865f2)
    .setFooter({ text: "Use /cancel_schedule id:ID to cancel one" })
    .setTimestamp();
}

function doClearStock(): EmbedBuilder {
  const count = readAuthUsers().length;
  if (count === 0) {
    return new EmbedBuilder()
      .setTitle("⚠️ Already Empty")
      .setDescription("There are no tokens in stock to remove.")
      .setColor(0xfaa61a)
      .setTimestamp();
  }
  fs.writeFileSync(AUTHS_FILE, "");
  return new EmbedBuilder()
    .setTitle("🗑️ Stock Cleared")
    .setDescription(`All **${count}** stored tokens have been removed.`)
    .setColor(0xed4245)
    .addFields({ name: "🗑️ Tokens Removed", value: `${count}`, inline: true })
    .setTimestamp();
}

function buildStockEmbed(): EmbedBuilder {
  const count = readAuthUsers().length;
  const hasStock = count > 0;
  return new EmbedBuilder()
    .setTitle(hasStock ? "✅ Stock Available" : "❌ Out of Stock")
    .setDescription(
      hasStock
        ? `There are currently **${count}** tokens in stock and ready to use.`
        : "There are **no tokens** in stock.\n\nUse `/restock` or `!restock` to add tokens."
    )
    .setColor(hasStock ? 0x57f287 : 0xed4245)
    .addFields({ name: "📦 Tokens in Stock", value: `${count}`, inline: true })
    .setTimestamp();
}

function buildStatusEmbed(client: Client): EmbedBuilder {
  const online = client.user !== null;
  const uptime = botStartTime
    ? (() => {
        const ms = Date.now() - botStartTime.getTime();
        const d = Math.floor(ms / 86400000);
        const h = Math.floor((ms % 86400000) / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        return `${d}d ${h}h ${m}m`;
      })()
    : "Unknown";
  const stock = readAuthUsers().length;
  return new EmbedBuilder()
    .setTitle(online ? "🟢 Bot Online" : "🔴 Bot Offline")
    .setColor(online ? 0x57f287 : 0xed4245)
    .addFields(
      { name: "📡 Status", value: online ? "Online" : "Offline", inline: true },
      { name: "⏱️ Uptime", value: uptime, inline: true },
      { name: "🌐 Servers", value: `${client.guilds.cache.size}`, inline: true },
      { name: "📦 Tokens in Stock", value: `${stock}`, inline: true },
      { name: "🏷️ Bot Tag", value: client.user?.tag ?? "Unknown", inline: true },
    )
    .setThumbnail(client.user?.displayAvatarURL() ?? null)
    .setTimestamp();
}

async function doCleanupServers(client: Client, currentGuildId: string): Promise<EmbedBuilder> {
  const guilds = [...client.guilds.cache.values()].filter((g) => g.id !== currentGuildId);
  if (guilds.length === 0) {
    return new EmbedBuilder()
      .setTitle("⚠️ No Other Servers")
      .setDescription("The bot is not in any other servers to leave.")
      .setColor(0xfaa61a)
      .setTimestamp();
  }
  let left = 0, failed = 0;
  for (const guild of guilds) {
    try {
      await guild.leave();
      serverJoinTimes.delete(guild.id);
      left++;
    } catch {
      failed++;
    }
  }
  return new EmbedBuilder()
    .setTitle("🧹 Cleanup Complete")
    .setDescription(`The bot has left all servers.`)
    .setColor(failed === 0 ? 0x57f287 : 0xfaa61a)
    .addFields(
      { name: "✅ Left", value: `${left}`, inline: true },
      { name: "❌ Failed", value: `${failed}`, inline: true },
      { name: "📊 Total", value: `${guilds.length}`, inline: true }
    )
    .setTimestamp();
}

// ─── Slash command router ─────────────────────────────────────────────────────

async function handleSlash(interaction: ChatInputCommandInteraction, client: Client) {
  const cmd = interaction.commandName;
  const guildOwnerId = interaction.guild?.ownerId ?? "";
  const guildId = interaction.guild?.id ?? "";
  const userId = interaction.user.id;
  const channelId = interaction.channelId;
  const authorized = isAuthorizedUser(guildOwnerId, guildId, userId);
  const realOwner = userId === guildOwnerId;

  switch (cmd) {
    case "help":
      await interaction.reply({ embeds: [buildHelpEmbed()], flags: 64 });
      break;

    case "get_token":
      await interaction.reply({ embeds: [buildGetTokenEmbed()], flags: 64 });
      break;

    case "auth": {
      const lockedCh = checkChannelLock(guildId, "auth", channelId);
      if (lockedCh) {
        await interaction.reply({ embeds: [channelLockedEmbed(lockedCh, "auth")], flags: 64 });
        return;
      }
      const code = interaction.options.getString("code", true).trim();
      await interaction.deferReply({ flags: 64 });
      const result = await doAuthExchange(code, userId);
      if (result.ok) {
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("✅ Authentication Successful").setDescription(`<@${userId}> has been authenticated.`).setColor(0x57f287).setTimestamp()] });
        logger.info({ userId }, "User authenticated");
      } else {
        await interaction.editReply(`❌ Auth failed: ${result.error}`);
      }
      break;
    }

    case "count":
      await interaction.reply({ embeds: [buildCountEmbed()], flags: 64 });
      break;

    case "list_users": {
      const { embed } = buildListUsersEmbed();
      await interaction.reply({ embeds: [embed], flags: 64 });
      break;
    }

    case "check_tokens": {
      await interaction.deferReply({ flags: 64 });
      await interaction.editReply({ embeds: [await doCheckTokens()] });
      break;
    }

    case "djoin": {
      const lockedCh = checkChannelLock(guildId, "djoin", channelId);
      if (lockedCh) {
        await interaction.reply({ embeds: [channelLockedEmbed(lockedCh, "djoin")], flags: 64 });
        return;
      }
      if (readAuthUsers().length === 0) {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle("❌ No Stock")
              .setDescription("There are no tokens in stock. Use `/restock` or `!restock` to add tokens before running djoin.")
              .setColor(0xed4245)
          ],
          flags: 64,
        });
        return;
      }
      if (!readAuthUsers().some((u) => u.userId === userId)) {
        await interaction.reply({ embeds: [notAuthedEmbed()], flags: 64 });
        return;
      }
      const serverId = interaction.options.getString("server_id", true).trim();
      let djoinLimit: number | undefined;
      if (!authorized) {
        const memberRoles = interaction.member?.roles;
        const roleIds: string[] = Array.isArray(memberRoles)
          ? memberRoles
          : memberRoles && typeof memberRoles === "object" && "cache" in memberRoles
            ? [...(memberRoles as { cache: Map<string, unknown> }).cache.keys()]
            : [];
        const limit = getRoleLimit(guildId, roleIds);
        if (limit === null) {
          const limits = getGuildRoleLimits(guildId);
          const limitLines = Object.entries(limits).map(([id, n]) => `<@&${id}> → ${n} members`).join("\n") || "*No role limits configured*";
          await interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle("❌ No Access")
                .setDescription(
                  "You don't have a role that grants access to `/djoin`.\n\n" +
                  "**Available role tiers:**\n" + limitLines
                )
                .setColor(0xed4245),
            ],
            flags: 64,
          });
          return;
        }
        djoinLimit = limit;
      }
      await interaction.deferReply();
      const embed = await doMassJoin(serverId, client, async (msg) => { await interaction.editReply(msg); }, djoinLimit);
      if (embed) await interaction.editReply({ content: "", embeds: [embed] });
      break;
    }

    case "servers":
      await interaction.reply({ embeds: [buildServersEmbed(client)], flags: 64 });
      break;

    case "server_age":
      await interaction.reply({ embeds: [buildServerAgeEmbed(interaction.options.getString("server_id"), client)], flags: 64 });
      break;

    case "invite":
      await interaction.reply({ embeds: [buildInviteEmbed()], flags: 64 });
      break;

    case "add": {
      const { embed, row } = buildAddEmbed(client);
      await interaction.reply({ embeds: [embed], components: [row] });
      break;
    }

    case "restock": {
      if (!authorized) { await interaction.reply({ embeds: [denyEmbed()], flags: 64 }); return; }
      const attachment = interaction.options.getAttachment("file");
      const pasted = interaction.options.getString("tokens");
      if (!attachment && !pasted) {
        await interaction.reply({ embeds: [noTokensEmbed()], flags: 64 });
        return;
      }
      await interaction.deferReply({ flags: 64 });
      let raw = "";
      if (attachment) {
        if (!attachment.contentType?.startsWith("text") && !attachment.name.endsWith(".txt")) {
          await interaction.editReply("❌ Please upload a `.txt` file."); return;
        }
        const r = await fetch(attachment.url);
        if (!r.ok) { await interaction.editReply("❌ Could not download the file."); return; }
        raw = await r.text();
      } else if (pasted) {
        raw = pasted;
      }
      await interaction.editReply({ embeds: [await doRestock(raw)] });
      break;
    }

    case "addowner": {
      if (!realOwner) { await interaction.reply({ embeds: [denyRealOwnerEmbed()], flags: 64 }); return; }
      const target = interaction.options.getUser("user", true);
      if (target.id === guildOwnerId) { await interaction.reply({ content: "❌ That user is already the server owner.", flags: 64 }); return; }
      if (isExtraOwner(guildId, target.id)) { await interaction.reply({ embeds: [new EmbedBuilder().setTitle("⚠️ Already an Extra Owner").setDescription(`<@${target.id}> already has extra owner access.`).setColor(0xfaa61a)], flags: 64 }); return; }
      addExtraOwner(guildId, target.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("✅ Extra Owner Added").setDescription(`<@${target.id}> now has access to owner-only commands.`).setColor(0x57f287).setTimestamp()] });
      break;
    }

    case "removeowner": {
      if (!realOwner) { await interaction.reply({ embeds: [denyRealOwnerEmbed()], flags: 64 }); return; }
      const target = interaction.options.getUser("user", true);
      if (!isExtraOwner(guildId, target.id)) { await interaction.reply({ content: `❌ <@${target.id}> is not an extra owner.`, flags: 64 }); return; }
      removeExtraOwner(guildId, target.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("🗑️ Extra Owner Removed").setDescription(`<@${target.id}> no longer has extra owner access.`).setColor(0xed4245).setTimestamp()] });
      break;
    }

    case "owners":
      await interaction.reply({ embeds: [buildOwnersEmbed(guildOwnerId, guildId)], flags: 64 });
      break;

    case "restart": {
      if (!authorized) { await interaction.reply({ embeds: [denyEmbed()], flags: 64 }); return; }
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("🔄 Restarting Bot...").setDescription("Disconnecting and reconnecting. Commands will be re-registered.\n\nThis takes about **5 seconds**.").setColor(0xfaa61a).setTimestamp()] });
      logger.info({ by: userId }, "Bot restart via /restart");
      await new Promise((r) => setTimeout(r, 1000));
      await client.destroy();
      await client.login(BOT_TOKEN);
      const guildIds = [...client.guilds.cache.keys()];
      await registerCommands(guildIds);
      try {
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("✅ Bot Restarted").setDescription(`Back online. **${guildIds.length}** server(s) have fresh commands.`).setColor(0x57f287).setTimestamp()] });
      } catch { /* interaction expired */ }
      break;
    }

    // ─── Role limit commands ───────────────────────────────────────────────────

    case "setrole": {
      if (!authorized) { await interaction.reply({ embeds: [denyEmbed()], flags: 64 }); return; }
      const role = interaction.options.getRole("role", true);
      const limit = interaction.options.getInteger("limit", true);
      const result = setGuildRoleLimit(guildId, role.id, limit);
      if (!result.ok) {
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("❌ Cannot Set Role Limit").setDescription(result.error!).setColor(0xed4245)], flags: 64 });
        return;
      }
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ Role Limit Set")
            .setDescription(`<@&${role.id}> can now djoin up to **${limit}** members.`)
            .setColor(0x57f287)
            .setFooter({ text: `${Object.keys(getGuildRoleLimits(guildId)).length}/${MAX_ROLES_PER_GUILD} role slots used` })
            .setTimestamp()
        ],
        flags: 64,
      });
      break;
    }

    case "removerole": {
      if (!authorized) { await interaction.reply({ embeds: [denyEmbed()], flags: 64 }); return; }
      const role = interaction.options.getRole("role", true);
      const removed = removeGuildRoleLimit(guildId, role.id);
      if (!removed) {
        await interaction.reply({ content: `❌ <@&${role.id}> doesn't have a limit set.`, flags: 64 });
        return;
      }
      await interaction.reply({
        embeds: [new EmbedBuilder().setTitle("🗑️ Role Limit Removed").setDescription(`<@&${role.id}> no longer has a djoin limit.`).setColor(0xed4245).setTimestamp()],
        flags: 64,
      });
      break;
    }

    case "listroles":
      await interaction.reply({ embeds: [buildRoleLimitsEmbed(guildId)], flags: 64 });
      break;

    // ─── Channel lock commands ─────────────────────────────────────────────────

    case "setchannel": {
      if (!authorized) { await interaction.reply({ embeds: [denyEmbed()], flags: 64 }); return; }
      const type = interaction.options.getString("type", true) as ChannelLockType;
      const channel = interaction.options.getChannel("channel", true);
      setChannelLock(guildId, type, channel.id);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("📌 Channel Lock Set")
            .setDescription(`The \`${type}\` command is now locked to <#${channel.id}>.\nUsers running it elsewhere will be redirected.`)
            .setColor(0x57f287)
            .setTimestamp()
        ],
        flags: 64,
      });
      break;
    }

    case "clearchannel": {
      if (!authorized) { await interaction.reply({ embeds: [denyEmbed()], flags: 64 }); return; }
      const type = interaction.options.getString("type", true) as ChannelLockType;
      const cleared = clearChannelLock(guildId, type);
      if (!cleared) {
        await interaction.reply({ content: `❌ No channel lock set for \`${type}\`.`, flags: 64 });
        return;
      }
      await interaction.reply({
        embeds: [new EmbedBuilder().setTitle("🔓 Channel Lock Cleared").setDescription(`The \`${type}\` command can now be used in any channel.`).setColor(0xed4245).setTimestamp()],
        flags: 64,
      });
      break;
    }

    case "listchannels":
      await interaction.reply({ embeds: [buildChannelLocksEmbed(guildId)], flags: 64 });
      break;

    case "dashboard":
      if (!authorized) { await interaction.reply({ embeds: [denyEmbed()], flags: 64 }); return; }
      await interaction.reply({ embeds: [buildDashboardEmbed()], flags: 64 });
      break;

    case "stock": {
      if (!interaction.channel || !interaction.channel.isTextBased()) {
        await interaction.reply({ content: "❌ Cannot post embed in this channel.", flags: 64 });
        break;
      }
      await interaction.reply({ content: "✅ Live stock embed posted below.", flags: 64 });
      const stockMsg = await interaction.channel.send({ embeds: [buildStockEmbed()] });
      liveMessages.set("stock", { channelId: stockMsg.channelId, messageId: stockMsg.id });
      break;
    }

    case "status": {
      if (!interaction.channel || !interaction.channel.isTextBased()) {
        await interaction.reply({ content: "❌ Cannot post embed in this channel.", flags: 64 });
        break;
      }
      await interaction.reply({ content: "✅ Live status embed posted below.", flags: 64 });
      const statusMsg = await interaction.channel.send({ embeds: [buildStatusEmbed(client)] });
      liveMessages.set("status", { channelId: statusMsg.channelId, messageId: statusMsg.id });
      break;
    }

    case "cleanup_servers": {
      if (!authorized) { await interaction.reply({ embeds: [denyEmbed()], flags: 64 }); return; }
      await interaction.deferReply({ flags: 64 });
      await interaction.editReply({ embeds: [await doCleanupServers(client, guildId)] });
      break;
    }

    case "clear_stock":
      if (!authorized) { await interaction.reply({ embeds: [denyEmbed()], flags: 64 }); return; }
      await interaction.reply({ embeds: [doClearStock()], flags: 64 });
      break;

    case "schedule_restock": {
      if (!authorized) { await interaction.reply({ embeds: [denyEmbed()], flags: 64 }); return; }
      const timeStr = interaction.options.getString("time", true);
      const delayMs = parseDuration(timeStr);
      if (!delayMs || delayMs < 60_000) {
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("❌ Invalid Time").setDescription("Provide a valid duration like `30m`, `1h`, or `1h30m`. Minimum is 1 minute.").setColor(0xed4245)], flags: 64 });
        return;
      }
      const attachment = interaction.options.getAttachment("file");
      const pasted = interaction.options.getString("tokens");
      if (!attachment && !pasted) { await interaction.reply({ embeds: [noTokensEmbed()], flags: 64 }); return; }
      await interaction.deferReply({ flags: 64 });
      let raw = "";
      if (attachment) {
        if (!attachment.contentType?.startsWith("text") && !attachment.name.endsWith(".txt")) { await interaction.editReply("❌ Please upload a `.txt` file."); return; }
        const r = await fetch(attachment.url);
        if (!r.ok) { await interaction.editReply("❌ Could not download the file."); return; }
        raw = await r.text();
      } else if (pasted) {
        raw = pasted;
      }
      const tokenCount = raw.split(/[\r\n]+/).filter(Boolean).length;
      const scheduleId = Date.now().toString(36).toUpperCase();
      const runAt = Date.now() + delayMs;
      addScheduledRestock({ id: scheduleId, runAt, rawTokens: raw, channelId, guildId, createdBy: userId });
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("📅 Restock Scheduled")
            .setDescription(`**${tokenCount} tokens** will be restocked in **${formatDuration(delayMs)}**.`)
            .setColor(0x5865f2)
            .addFields(
              { name: "🆔 Schedule ID", value: `\`${scheduleId}\``, inline: true },
              { name: "⏰ Runs At", value: `<t:${Math.floor(runAt / 1000)}:T>`, inline: true },
              { name: "📦 Tokens", value: `${tokenCount}`, inline: true }
            )
            .setFooter({ text: "Use /cancel_schedule to cancel" })
            .setTimestamp()
        ],
      });
      break;
    }

    case "list_schedules":
      if (!authorized) { await interaction.reply({ embeds: [denyEmbed()], flags: 64 }); return; }
      await interaction.reply({ embeds: [buildListSchedulesEmbed()], flags: 64 });
      break;

    case "cancel_schedule": {
      if (!authorized) { await interaction.reply({ embeds: [denyEmbed()], flags: 64 }); return; }
      const id = interaction.options.getString("id", true).trim().toUpperCase();
      const removed = removeScheduledRestock(id);
      await interaction.reply({
        embeds: [
          removed
            ? new EmbedBuilder().setTitle("✅ Schedule Cancelled").setDescription(`Schedule \`${id}\` has been removed.`).setColor(0x57f287).setTimestamp()
            : new EmbedBuilder().setTitle("❌ Not Found").setDescription(`No schedule with ID \`${id}\` was found.`).setColor(0xed4245).setTimestamp()
        ],
        flags: 64,
      });
      break;
    }

    case "set_daily_restock": {
      if (!authorized) { await interaction.reply({ embeds: [denyEmbed()], flags: 64 }); return; }
      const timeInput = interaction.options.getString("time", true).trim();
      if (!/^\d{1,2}:\d{2}$/.test(timeInput)) {
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("❌ Invalid Time Format").setDescription("Use 24-hour format like `14:00` or `08:30`.").setColor(0xed4245)], flags: 64 });
        return;
      }
      const [hh, mm] = timeInput.split(":").map(Number);
      if (hh! > 23 || mm! > 59) {
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("❌ Invalid Time").setDescription("Hours must be 0–23 and minutes 0–59.").setColor(0xed4245)], flags: 64 });
        return;
      }
      const normalizedTime = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      const attachment = interaction.options.getAttachment("file");
      const pasted = interaction.options.getString("tokens");
      if (!attachment && !pasted) { await interaction.reply({ embeds: [noTokensEmbed()], flags: 64 }); return; }
      await interaction.deferReply({ flags: 64 });
      let raw = "";
      if (attachment) {
        if (!attachment.contentType?.startsWith("text") && !attachment.name.endsWith(".txt")) { await interaction.editReply("❌ Please upload a `.txt` file."); return; }
        const r = await fetch(attachment.url);
        if (!r.ok) { await interaction.editReply("❌ Could not download the file."); return; }
        raw = await r.text();
      } else if (pasted) {
        raw = pasted;
      }
      const tokenCount = raw.split(/[\r\n]+/).filter(Boolean).length;
      writeDailyRestock({ time: normalizedTime, rawTokens: raw, channelId, guildId, createdBy: userId, lastRanDate: null });
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("📅 Daily Restock Set")
            .setDescription(`The bot will restock **${tokenCount} tokens** every day at **${normalizedTime} MST**.`)
            .setColor(0x57f287)
            .addFields(
              { name: "⏰ Time (MST)", value: normalizedTime, inline: true },
              { name: "📦 Tokens", value: `${tokenCount}`, inline: true },
            )
            .setFooter({ text: "Use /cancel_daily_restock to stop it" })
            .setTimestamp()
        ],
      });
      break;
    }

    case "cancel_daily_restock": {
      if (!authorized) { await interaction.reply({ embeds: [denyEmbed()], flags: 64 }); return; }
      const existing = readDailyRestock();
      if (!existing) {
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("⚠️ Nothing to Cancel").setDescription("No daily restock is currently configured.").setColor(0xfaa61a)], flags: 64 });
        return;
      }
      writeDailyRestock(null);
      await interaction.reply({ embeds: [new EmbedBuilder().setTitle("✅ Daily Restock Cancelled").setDescription("The daily restock has been removed.").setColor(0xed4245).setTimestamp()], flags: 64 });
      break;
    }

    case "daily_restock_status":
      if (!authorized) { await interaction.reply({ embeds: [denyEmbed()], flags: 64 }); return; }
      await interaction.reply({ embeds: [buildDailyRestockStatusEmbed()], flags: 64 });
      break;

    case "edit_daily_restock": {
      if (!authorized) { await interaction.reply({ embeds: [denyEmbed()], flags: 64 }); return; }
      const existing = readDailyRestock();
      if (!existing) {
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("❌ No Daily Restock").setDescription("No daily restock is set up yet. Use `/set_daily_restock` to create one.").setColor(0xed4245)], flags: 64 });
        return;
      }
      const newTimeInput = interaction.options.getString("time");
      const newAttachment = interaction.options.getAttachment("file");
      const newPasted = interaction.options.getString("tokens");
      if (!newTimeInput && !newAttachment && !newPasted) {
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle("⚠️ Nothing to Update").setDescription("Provide at least a new `time`, `file`, or `tokens` to update.").setColor(0xfaa61a)], flags: 64 });
        return;
      }
      let normalizedTime = existing.time;
      if (newTimeInput) {
        if (!/^\d{1,2}:\d{2}$/.test(newTimeInput.trim())) {
          await interaction.reply({ embeds: [new EmbedBuilder().setTitle("❌ Invalid Time Format").setDescription("Use 24-hour MST format like `14:00` or `08:30`.").setColor(0xed4245)], flags: 64 });
          return;
        }
        const [hh, mm] = newTimeInput.trim().split(":").map(Number);
        if (hh! > 23 || mm! > 59) {
          await interaction.reply({ embeds: [new EmbedBuilder().setTitle("❌ Invalid Time").setDescription("Hours must be 0–23 and minutes 0–59.").setColor(0xed4245)], flags: 64 });
          return;
        }
        normalizedTime = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      }
      await interaction.deferReply({ flags: 64 });
      let rawTokens = existing.rawTokens;
      if (newAttachment) {
        if (!newAttachment.contentType?.startsWith("text") && !newAttachment.name.endsWith(".txt")) { await interaction.editReply("❌ Please upload a `.txt` file."); return; }
        const r = await fetch(newAttachment.url);
        if (!r.ok) { await interaction.editReply("❌ Could not download the file."); return; }
        rawTokens = await r.text();
      } else if (newPasted) {
        rawTokens = newPasted;
      }
      writeDailyRestock({ ...existing, time: normalizedTime, rawTokens });
      const tokenCount = rawTokens.split(/[\r\n]+/).filter(Boolean).length;
      const changes: string[] = [];
      if (newTimeInput) changes.push(`⏰ Time → **${normalizedTime} MST**`);
      if (newAttachment || newPasted) changes.push(`📦 Tokens → **${tokenCount} tokens**`);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("✅ Daily Restock Updated")
            .setDescription(changes.join("\n"))
            .setColor(0x57f287)
            .addFields(
              { name: "⏰ Time (MST)", value: normalizedTime, inline: true },
              { name: "📦 Tokens", value: `${tokenCount}`, inline: true },
            )
            .setTimestamp()
        ],
      });
      break;
    }

    default:
      await interaction.reply({ content: "❌ Unknown command.", flags: 64 });
  }
}

// ─── Prefix command router ────────────────────────────────────────────────────

async function handlePrefix(message: Message, client: Client) {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift()?.toLowerCase();
  if (!cmd) return;

  const guildOwnerId = message.guild?.ownerId ?? "";
  const guildId = message.guild?.id ?? "";
  const userId = message.author.id;
  const channelId = message.channelId;
  const authorized = isAuthorizedUser(guildOwnerId, guildId, userId);
  const realOwner = userId === guildOwnerId;

  try {
    switch (cmd) {
      case "help":
        await message.reply({ embeds: [buildHelpEmbed()] });
        break;

      case "get_token":
        await message.reply({ embeds: [buildGetTokenEmbed()] });
        break;

      case "auth": {
        const lockedCh = checkChannelLock(guildId, "auth", channelId);
        if (lockedCh) { await message.reply({ embeds: [channelLockedEmbed(lockedCh, "auth")] }); return; }
        const code = args[0]?.trim();
        if (!code) { await message.reply("❌ Usage: `!auth YOUR_CODE`"); return; }
        const loading = await message.reply("🔄 Authenticating...");
        const result = await doAuthExchange(code, userId);
        if (result.ok) {
          await loading.edit({ content: "", embeds: [new EmbedBuilder().setTitle("✅ Authentication Successful").setDescription(`<@${userId}> has been authenticated.`).setColor(0x57f287).setTimestamp()] });
          logger.info({ userId }, "User authenticated via prefix");
        } else {
          await loading.edit(`❌ Auth failed: ${result.error}`);
        }
        break;
      }

      case "count":
        await message.reply({ embeds: [buildCountEmbed()] });
        break;

      case "list_users": {
        const { embed } = buildListUsersEmbed();
        await message.reply({ embeds: [embed] });
        break;
      }

      case "check_tokens": {
        const loading = await message.reply("🔄 Checking tokens...");
        const embed = await doCheckTokens();
        await loading.edit({ content: "", embeds: [embed] });
        break;
      }

      case "djoin": {
        const lockedCh = checkChannelLock(guildId, "djoin", channelId);
        if (lockedCh) { await message.reply({ embeds: [channelLockedEmbed(lockedCh, "djoin")] }); return; }
        if (readAuthUsers().length === 0) {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle("❌ No Stock")
                .setDescription("There are no tokens in stock. Use `/restock` or `!restock` to add tokens before running djoin.")
                .setColor(0xed4245)
            ],
          });
          return;
        }
        if (!readAuthUsers().some((u) => u.userId === userId)) {
          await message.reply({ embeds: [notAuthedEmbed()] }); return;
        }
        const serverId = args[0]?.trim();
        if (!serverId) { await message.reply("❌ Usage: `!djoin SERVER_ID`"); return; }
        const loading = await message.reply(`🚀 Starting mass join to \`${serverId}\`...`);
        const embed = await doMassJoin(serverId, client, async (msg) => { await loading.edit(msg); });
        if (embed) await loading.edit({ content: "", embeds: [embed] });
        break;
      }

      case "servers":
        await message.reply({ embeds: [buildServersEmbed(client)] });
        break;

      case "server_age": {
        const serverId = args[0]?.trim() ?? null;
        await message.reply({ embeds: [buildServerAgeEmbed(serverId, client)] });
        break;
      }

      case "invite":
        await message.reply({ embeds: [buildInviteEmbed()] });
        break;

      case "add": {
        const { embed, row } = buildAddEmbed(client);
        await message.reply({ embeds: [embed], components: [row] });
        break;
      }

      case "restock": {
        if (!authorized) { await message.reply({ embeds: [denyEmbed()] }); return; }
        const attachment: Attachment | undefined = message.attachments.first();
        const pastedText = args.join("\n");
        if (!attachment && !pastedText) { await message.reply({ embeds: [noTokensEmbed()] }); return; }
        const loading = await message.reply("🔄 Processing tokens...");
        let raw = "";
        if (attachment) {
          if (!attachment.contentType?.startsWith("text") && !attachment.name.endsWith(".txt")) {
            await loading.edit("❌ Please attach a `.txt` file."); return;
          }
          const r = await fetch(attachment.url);
          if (!r.ok) { await loading.edit("❌ Could not download the file."); return; }
          raw = await r.text();
        } else {
          raw = pastedText;
        }
        await loading.edit({ content: "", embeds: [await doRestock(raw)] });
        break;
      }

      case "addowner": {
        if (!realOwner) { await message.reply({ embeds: [denyRealOwnerEmbed()] }); return; }
        const mention = args[0];
        const targetId = mention?.replace(/[<@!>]/g, "");
        if (!targetId) { await message.reply("❌ Usage: `!addowner @user`"); return; }
        if (targetId === guildOwnerId) { await message.reply("❌ That user is already the server owner."); return; }
        if (isExtraOwner(guildId, targetId)) { await message.reply({ embeds: [new EmbedBuilder().setTitle("⚠️ Already an Extra Owner").setDescription(`<@${targetId}> already has extra owner access.`).setColor(0xfaa61a)] }); return; }
        addExtraOwner(guildId, targetId);
        await message.reply({ embeds: [new EmbedBuilder().setTitle("✅ Extra Owner Added").setDescription(`<@${targetId}> now has access to owner-only commands.`).setColor(0x57f287).setTimestamp()] });
        break;
      }

      case "removeowner": {
        if (!realOwner) { await message.reply({ embeds: [denyRealOwnerEmbed()] }); return; }
        const mention = args[0];
        const targetId = mention?.replace(/[<@!>]/g, "");
        if (!targetId) { await message.reply("❌ Usage: `!removeowner @user`"); return; }
        if (!isExtraOwner(guildId, targetId)) { await message.reply(`❌ <@${targetId}> is not an extra owner.`); return; }
        removeExtraOwner(guildId, targetId);
        await message.reply({ embeds: [new EmbedBuilder().setTitle("🗑️ Extra Owner Removed").setDescription(`<@${targetId}> no longer has extra owner access.`).setColor(0xed4245).setTimestamp()] });
        break;
      }

      case "owners":
        await message.reply({ embeds: [buildOwnersEmbed(guildOwnerId, guildId)] });
        break;

      case "restart": {
        if (!authorized) { await message.reply({ embeds: [denyEmbed()] }); return; }
        const loading = await message.reply({ embeds: [new EmbedBuilder().setTitle("🔄 Restarting Bot...").setDescription("Disconnecting and reconnecting. Commands will be re-registered.\n\nThis takes about **5 seconds**.").setColor(0xfaa61a).setTimestamp()] });
        logger.info({ by: userId }, "Bot restart via !restart");
        await new Promise((r) => setTimeout(r, 1000));
        await client.destroy();
        await client.login(BOT_TOKEN);
        const guildIds = [...client.guilds.cache.keys()];
        await registerCommands(guildIds);
        try {
          await loading.edit({ embeds: [new EmbedBuilder().setTitle("✅ Bot Restarted").setDescription(`Back online. **${guildIds.length}** server(s) have fresh commands.`).setColor(0x57f287).setTimestamp()] });
        } catch { /* message deleted */ }
        break;
      }

      // ─── Role limit prefix commands ──────────────────────────────────────────

      case "setrole": {
        if (!authorized) { await message.reply({ embeds: [denyEmbed()] }); return; }
        const roleId = args[0]?.trim();
        const limitStr = args[1]?.trim();
        if (!roleId || !limitStr) { await message.reply("❌ Usage: `!setrole ROLE_ID LIMIT`\nExample: `!setrole 123456789 10`"); return; }
        const limit = parseInt(limitStr, 10);
        if (isNaN(limit) || limit < 1) { await message.reply("❌ Limit must be a positive number."); return; }
        const result = setGuildRoleLimit(guildId, roleId, limit);
        if (!result.ok) {
          await message.reply({ embeds: [new EmbedBuilder().setTitle("❌ Cannot Set Role Limit").setDescription(result.error!).setColor(0xed4245)] });
          return;
        }
        await message.reply({ embeds: [new EmbedBuilder().setTitle("✅ Role Limit Set").setDescription(`<@&${roleId}> can now djoin up to **${limit}** members.`).setColor(0x57f287).setTimestamp()] });
        break;
      }

      case "removerole": {
        if (!authorized) { await message.reply({ embeds: [denyEmbed()] }); return; }
        const roleId = args[0]?.trim();
        if (!roleId) { await message.reply("❌ Usage: `!removerole ROLE_ID`"); return; }
        const removed = removeGuildRoleLimit(guildId, roleId);
        if (!removed) { await message.reply(`❌ No limit set for role \`${roleId}\`.`); return; }
        await message.reply({ embeds: [new EmbedBuilder().setTitle("🗑️ Role Limit Removed").setDescription(`Role \`${roleId}\` no longer has a djoin limit.`).setColor(0xed4245).setTimestamp()] });
        break;
      }

      case "listroles":
        await message.reply({ embeds: [buildRoleLimitsEmbed(guildId)] });
        break;

      // ─── Channel lock prefix commands ────────────────────────────────────────

      case "setchannel": {
        if (!authorized) { await message.reply({ embeds: [denyEmbed()] }); return; }
        const type = args[0]?.toLowerCase() as ChannelLockType | undefined;
        const chId = args[1]?.trim();
        if (!type || !["djoin", "auth"].includes(type) || !chId) {
          await message.reply("❌ Usage: `!setchannel djoin|auth CHANNEL_ID`"); return;
        }
        setChannelLock(guildId, type, chId);
        await message.reply({ embeds: [new EmbedBuilder().setTitle("📌 Channel Lock Set").setDescription(`The \`${type}\` command is now locked to <#${chId}>.`).setColor(0x57f287).setTimestamp()] });
        break;
      }

      case "clearchannel": {
        if (!authorized) { await message.reply({ embeds: [denyEmbed()] }); return; }
        const type = args[0]?.toLowerCase() as ChannelLockType | undefined;
        if (!type || !["djoin", "auth"].includes(type)) { await message.reply("❌ Usage: `!clearchannel djoin|auth`"); return; }
        const cleared = clearChannelLock(guildId, type);
        if (!cleared) { await message.reply(`❌ No channel lock set for \`${type}\`.`); return; }
        await message.reply({ embeds: [new EmbedBuilder().setTitle("🔓 Channel Lock Cleared").setDescription(`The \`${type}\` command can now be used in any channel.`).setColor(0xed4245).setTimestamp()] });
        break;
      }

      case "listchannels":
        await message.reply({ embeds: [buildChannelLocksEmbed(guildId)] });
        break;

      case "dashboard": {
        if (!authorized) { await message.reply({ embeds: [denyEmbed()] }); return; }
        try {
          await message.author.send({ embeds: [buildDashboardEmbed()] });
          await message.reply("✅ Dashboard link sent to your DMs!");
        } catch {
          await message.reply({ content: "❌ Could not send you a DM. Please enable DMs from server members.", embeds: [buildDashboardEmbed()] });
        }
        break;
      }

      case "stock": {
        const stockReply = await message.reply({ embeds: [buildStockEmbed()] });
        liveMessages.set("stock", { channelId: stockReply.channelId, messageId: stockReply.id });
        break;
      }

      case "status": {
        const statusReply = await message.reply({ embeds: [buildStatusEmbed(client)] });
        liveMessages.set("status", { channelId: statusReply.channelId, messageId: statusReply.id });
        break;
      }

      case "cleanup_servers": {
        if (!authorized) { await message.reply({ embeds: [denyEmbed()] }); return; }
        const loading = await message.reply("🧹 Leaving all servers...");
        await loading.edit({ content: "", embeds: [await doCleanupServers(client, guildId)] });
        break;
      }

      case "clear_stock":
        if (!authorized) { await message.reply({ embeds: [denyEmbed()] }); return; }
        await message.reply({ embeds: [doClearStock()] });
        break;

      case "schedule_restock": {
        if (!authorized) { await message.reply({ embeds: [denyEmbed()] }); return; }
        const timeArg = args[0]?.trim();
        if (!timeArg) { await message.reply("❌ Usage: `!schedule_restock TIME` — e.g. `!schedule_restock 1h30m`"); return; }
        const delayMs = parseDuration(timeArg);
        if (!delayMs || delayMs < 60_000) {
          await message.reply({ embeds: [new EmbedBuilder().setTitle("❌ Invalid Time").setDescription("Provide a valid duration like `30m`, `1h`, or `1h30m`. Minimum is 1 minute.").setColor(0xed4245)] });
          return;
        }
        const attachment: Attachment | undefined = message.attachments.first();
        const pastedText = args.slice(1).join("\n");
        if (!attachment && !pastedText) { await message.reply({ embeds: [noTokensEmbed()] }); return; }
        const loading = await message.reply("🔄 Processing scheduled restock...");
        let raw = "";
        if (attachment) {
          if (!attachment.contentType?.startsWith("text") && !attachment.name.endsWith(".txt")) { await loading.edit("❌ Please attach a `.txt` file."); return; }
          const r = await fetch(attachment.url);
          if (!r.ok) { await loading.edit("❌ Could not download the file."); return; }
          raw = await r.text();
        } else {
          raw = pastedText;
        }
        const tokenCount = raw.split(/[\r\n]+/).filter(Boolean).length;
        const scheduleId = Date.now().toString(36).toUpperCase();
        const runAt = Date.now() + delayMs;
        addScheduledRestock({ id: scheduleId, runAt, rawTokens: raw, channelId, guildId, createdBy: userId });
        await loading.edit({
          content: "",
          embeds: [
            new EmbedBuilder()
              .setTitle("📅 Restock Scheduled")
              .setDescription(`**${tokenCount} tokens** will be restocked in **${formatDuration(delayMs)}**.`)
              .setColor(0x5865f2)
              .addFields(
                { name: "🆔 Schedule ID", value: `\`${scheduleId}\``, inline: true },
                { name: "⏰ Runs At", value: `<t:${Math.floor(runAt / 1000)}:T>`, inline: true },
                { name: "📦 Tokens", value: `${tokenCount}`, inline: true }
              )
              .setFooter({ text: "Use !cancel_schedule ID to cancel" })
              .setTimestamp()
          ],
        });
        break;
      }

      case "list_schedules":
        if (!authorized) { await message.reply({ embeds: [denyEmbed()] }); return; }
        await message.reply({ embeds: [buildListSchedulesEmbed()] });
        break;

      case "cancel_schedule": {
        if (!authorized) { await message.reply({ embeds: [denyEmbed()] }); return; }
        const id = args[0]?.trim().toUpperCase();
        if (!id) { await message.reply("❌ Usage: `!cancel_schedule ID`"); return; }
        const removed = removeScheduledRestock(id);
        await message.reply({
          embeds: [
            removed
              ? new EmbedBuilder().setTitle("✅ Schedule Cancelled").setDescription(`Schedule \`${id}\` has been removed.`).setColor(0x57f287).setTimestamp()
              : new EmbedBuilder().setTitle("❌ Not Found").setDescription(`No schedule with ID \`${id}\` was found.`).setColor(0xed4245).setTimestamp()
          ],
        });
        break;
      }

      case "set_daily_restock": {
        if (!authorized) { await message.reply({ embeds: [denyEmbed()] }); return; }
        const timeArg = args[0]?.trim();
        if (!timeArg || !/^\d{1,2}:\d{2}$/.test(timeArg)) { await message.reply("❌ Usage: `!set_daily_restock HH:MM` — e.g. `!set_daily_restock 14:00`"); return; }
        const [hh, mm] = timeArg.split(":").map(Number);
        if (hh! > 23 || mm! > 59) { await message.reply({ embeds: [new EmbedBuilder().setTitle("❌ Invalid Time").setDescription("Hours must be 0–23 and minutes 0–59.").setColor(0xed4245)] }); return; }
        const normalizedTime = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
        const attachment: Attachment | undefined = message.attachments.first();
        const pastedText = args.slice(1).join("\n");
        if (!attachment && !pastedText) { await message.reply({ embeds: [noTokensEmbed()] }); return; }
        const loading = await message.reply("🔄 Setting up daily restock...");
        let raw = "";
        if (attachment) {
          if (!attachment.contentType?.startsWith("text") && !attachment.name.endsWith(".txt")) { await loading.edit("❌ Please attach a `.txt` file."); return; }
          const r = await fetch(attachment.url);
          if (!r.ok) { await loading.edit("❌ Could not download the file."); return; }
          raw = await r.text();
        } else {
          raw = pastedText;
        }
        const tokenCount = raw.split(/[\r\n]+/).filter(Boolean).length;
        writeDailyRestock({ time: normalizedTime, rawTokens: raw, channelId, guildId, createdBy: userId, lastRanDate: null });
        await loading.edit({
          content: "",
          embeds: [
            new EmbedBuilder()
              .setTitle("📅 Daily Restock Set")
              .setDescription(`The bot will restock **${tokenCount} tokens** every day at **${normalizedTime} MST**.`)
              .setColor(0x57f287)
              .addFields(
                { name: "⏰ Time (MST)", value: normalizedTime, inline: true },
                { name: "📦 Tokens", value: `${tokenCount}`, inline: true },
              )
              .setFooter({ text: "Use !cancel_daily_restock to stop it" })
              .setTimestamp()
          ],
        });
        break;
      }

      case "cancel_daily_restock": {
        if (!authorized) { await message.reply({ embeds: [denyEmbed()] }); return; }
        const existing = readDailyRestock();
        if (!existing) { await message.reply({ embeds: [new EmbedBuilder().setTitle("⚠️ Nothing to Cancel").setDescription("No daily restock is currently configured.").setColor(0xfaa61a)] }); return; }
        writeDailyRestock(null);
        await message.reply({ embeds: [new EmbedBuilder().setTitle("✅ Daily Restock Cancelled").setDescription("The daily restock has been removed.").setColor(0xed4245).setTimestamp()] });
        break;
      }

      case "daily_restock_status":
        if (!authorized) { await message.reply({ embeds: [denyEmbed()] }); return; }
        await message.reply({ embeds: [buildDailyRestockStatusEmbed()] });
        break;

      case "edit_daily_restock": {
        if (!authorized) { await message.reply({ embeds: [denyEmbed()] }); return; }
        const existing = readDailyRestock();
        if (!existing) {
          await message.reply({ embeds: [new EmbedBuilder().setTitle("❌ No Daily Restock").setDescription("No daily restock is set up yet. Use `!set_daily_restock` to create one.").setColor(0xed4245)] });
          return;
        }
        const newTimeArg = args[0]?.trim();
        const hasNewTime = newTimeArg && /^\d{1,2}:\d{2}$/.test(newTimeArg);
        const attachment: Attachment | undefined = message.attachments.first();
        const pastedText = args.slice(hasNewTime ? 1 : 0).join("\n");
        if (!hasNewTime && !attachment && !pastedText) {
          await message.reply({ embeds: [new EmbedBuilder().setTitle("⚠️ Nothing to Update").setDescription("Usage: `!edit_daily_restock [HH:MM] [tokens]` — provide a new time and/or attach a file.").setColor(0xfaa61a)] });
          return;
        }
        let normalizedTime = existing.time;
        if (hasNewTime) {
          const [hh, mm] = newTimeArg!.split(":").map(Number);
          if (hh! > 23 || mm! > 59) { await message.reply({ embeds: [new EmbedBuilder().setTitle("❌ Invalid Time").setDescription("Hours must be 0–23 and minutes 0–59.").setColor(0xed4245)] }); return; }
          normalizedTime = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
        }
        const loading = await message.reply("🔄 Updating daily restock...");
        let rawTokens = existing.rawTokens;
        if (attachment) {
          if (!attachment.contentType?.startsWith("text") && !attachment.name.endsWith(".txt")) { await loading.edit("❌ Please attach a `.txt` file."); return; }
          const r = await fetch(attachment.url);
          if (!r.ok) { await loading.edit("❌ Could not download the file."); return; }
          rawTokens = await r.text();
        } else if (pastedText) {
          rawTokens = pastedText;
        }
        writeDailyRestock({ ...existing, time: normalizedTime, rawTokens });
        const tokenCount = rawTokens.split(/[\r\n]+/).filter(Boolean).length;
        const changes: string[] = [];
        if (hasNewTime) changes.push(`⏰ Time → **${normalizedTime} MST**`);
        if (attachment || pastedText) changes.push(`📦 Tokens → **${tokenCount} tokens**`);
        await loading.edit({
          content: "",
          embeds: [
            new EmbedBuilder()
              .setTitle("✅ Daily Restock Updated")
              .setDescription(changes.join("\n"))
              .setColor(0x57f287)
              .addFields(
                { name: "⏰ Time (MST)", value: normalizedTime, inline: true },
                { name: "📦 Tokens", value: `${tokenCount}`, inline: true },
              )
              .setTimestamp()
          ],
        });
        break;
      }

      default:
        await message.reply(`❌ Unknown command. Use \`!help\` to see all commands.`);
    }
  } catch (err) {
    logger.error({ err, cmd }, "Prefix command error");
    await message.reply("❌ An error occurred while running that command.").catch(() => {});
  }
}

// ─── Bot startup ──────────────────────────────────────────────────────────────

export async function startBot() {
  if (!BOT_TOKEN || !CLIENT_ID || !CLIENT_SECRET) {
    logger.warn("Discord credentials not set — bot will not start");
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once("ready", async () => {
    logger.info({ tag: client.user?.tag }, "Discord bot ready");
    botStartTime = new Date();
    setClient(client);
    const guildIds: string[] = [];
    for (const guild of client.guilds.cache.values()) {
      if (!serverJoinTimes.has(guild.id)) serverJoinTimes.set(guild.id, new Date());
      guildIds.push(guild.id);
    }
    await registerCommands(guildIds);
  });

  client.on("guildCreate", async (guild) => {
    serverJoinTimes.set(guild.id, new Date());
    logger.info({ guildId: guild.id, guildName: guild.name }, "Bot joined server");
    const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);
    try {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guild.id), { body: slashCommands });
    } catch (err) {
      logger.warn({ err, guildId: guild.id }, "Failed to register commands for new guild");
    }
  });

  client.on("guildDelete", (guild) => {
    serverJoinTimes.delete(guild.id);
    logger.info({ guildId: guild.id }, "Bot left server");
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    try {
      await handleSlash(interaction, client);
    } catch (err) {
      logger.error({ err, cmd: interaction.commandName }, "Slash command error");
      const msg = { content: "❌ An error occurred.", flags: 64 as const };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
      else await interaction.reply(msg);
    }
  });

  client.on("messageCreate", async (message) => {
    const guildId = message.guild?.id;
    if (guildId) {
      const djoinChannel = getChannelLock(guildId, "djoin");
      if (djoinChannel && message.channelId === djoinChannel) {
        const guildOwnerId = message.guild?.ownerId ?? "";
        const isOwner = isAuthorizedUser(guildOwnerId, guildId, message.author.id);
        if (!isOwner) {
          setTimeout(() => { message.delete().catch(() => {}); }, 15_000);
        }
      }
    }
    await handlePrefix(message, client);
  });

  setInterval(async () => {
    for (const guild of client.guilds.cache.values()) {
      const joinedAt = serverJoinTimes.get(guild.id);
      if (!joinedAt) continue;
      const days = (Date.now() - joinedAt.getTime()) / 86400000;
      if (days >= 14) {
        logger.info({ guildId: guild.id, guildName: guild.name, days }, "Auto-leaving old server");
        try { await guild.leave(); serverJoinTimes.delete(guild.id); } catch (err) { logger.error({ err }, "Failed to leave server"); }
      }
    }
  }, 3600_000);

  setInterval(async () => {
    const daily = readDailyRestock();
    if (daily) {
      const now = new Date();
      const mstHours = (now.getUTCHours() - 7 + 24) % 24;
      const currentTime = `${String(mstHours).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
      const today = getTodayDateString();
      if (currentTime === daily.time && daily.lastRanDate !== today) {
        daily.lastRanDate = today;
        writeDailyRestock(daily);
        const resultEmbed = await doRestock(daily.rawTokens);
        const notifyEmbed = new EmbedBuilder()
          .setTitle("📅 Daily Restock Ran")
          .setDescription(`Daily restock at **${daily.time} MST** has completed.`)
          .setColor(0x57f287)
          .setTimestamp();
        try {
          const channel = await client.channels.fetch(daily.channelId);
          if (channel && channel.isTextBased()) {
            await channel.send({ embeds: [notifyEmbed, resultEmbed] });
          }
        } catch (err) {
          logger.warn({ err }, "Could not notify channel for daily restock");
        }
      }
    }
  }, 60_000);

  setInterval(async () => {
    const pending = readScheduledRestocks();
    const now = Date.now();
    const due = pending.filter((s) => s.runAt <= now);
    if (due.length === 0) return;
    const remaining = pending.filter((s) => s.runAt > now);
    writeScheduledRestocks(remaining);
    for (const schedule of due) {
      const resultEmbed = await doRestock(schedule.rawTokens);
      const notifyEmbed = new EmbedBuilder()
        .setTitle("📅 Scheduled Restock Ran")
        .setDescription(`Schedule \`${schedule.id}\` (created by <@${schedule.createdBy}>) has completed.`)
        .setColor(0x57f287)
        .setTimestamp();
      try {
        const channel = await client.channels.fetch(schedule.channelId);
        if (channel && channel.isTextBased()) {
          await channel.send({ embeds: [notifyEmbed, resultEmbed] });
        }
      } catch (err) {
        logger.warn({ err, scheduleId: schedule.id }, "Could not notify channel for scheduled restock");
      }
    }
  }, 60_000);

  setInterval(async () => {
    for (const [type, ref] of liveMessages.entries()) {
      try {
        const channel = await client.channels.fetch(ref.channelId);
        if (!channel || !channel.isTextBased()) { liveMessages.delete(type); continue; }
        const msg = await channel.messages.fetch(ref.messageId);
        const embed = type === "stock" ? buildStockEmbed() : buildStatusEmbed(client);
        await msg.edit({ embeds: [embed] });
        logger.info({ type, messageId: ref.messageId }, "Live embed updated");
      } catch (err) {
        logger.warn({ err, type }, "Failed to update live embed — removing tracker");
        liveMessages.delete(type);
      }
    }
  }, 30_000);

  await client.login(BOT_TOKEN);
}
