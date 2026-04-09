import { Router } from "express";
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { getClient } from "../bot/botState";
import {
  readAuthUsers,
  deleteUserAuth,
  doRestock,
  doCheckTokens,
  doMassJoin,
  readExtraOwners,
  getGuildExtraOwners,
  addExtraOwner,
  removeExtraOwner,
  readRoleLimits,
  getGuildRoleLimits,
  setGuildRoleLimit,
  removeGuildRoleLimit,
  readChannelLocks,
  getChannelLock,
  setChannelLock,
  clearChannelLock,
} from "../bot/index";
import { logger } from "../lib/logger";

const router = Router();

const BOT_TOKEN = process.env["DISCORD_BOT_TOKEN"] ?? "";
const JWT_SECRET = (process.env["DISCORD_CLIENT_SECRET"] ?? "fallback") + "_dashboard_v1";
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

// ─── Simple JWT-like token (no external dep) ──────────────────────────────────

function signToken(payload: Record<string, unknown>): string {
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + TOKEN_TTL_MS })).toString("base64url");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifyToken(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [data, sig] = parts as [string, string];
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as { exp: number };
    if (payload.exp < Date.now()) return null;
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing token" });
    return;
  }
  const token = auth.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  (req as Request & { dashboardUser: Record<string, unknown> }).dashboardUser = payload;
  next();
}

// ─── Login ────────────────────────────────────────────────────────────────────

router.post("/auth/login", (req: Request, res: Response) => {
  const { botToken } = req.body as { botToken?: string };
  if (!botToken || botToken.trim() !== BOT_TOKEN) {
    res.status(401).json({ error: "Invalid bot token" });
    return;
  }
  const token = signToken({ role: "owner" });
  res.json({ token });
});

router.post("/auth/verify", (req: Request, res: Response) => {
  const { token } = req.body as { token?: string };
  if (!token) { res.status(400).json({ error: "No token" }); return; }
  const payload = verifyToken(token);
  if (!payload) { res.status(401).json({ error: "Invalid or expired token" }); return; }
  res.json({ valid: true });
});

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get("/stats", requireAuth, (_req: Request, res: Response) => {
  const client = getClient();
  const users = readAuthUsers();
  const guilds = client ? [...client.guilds.cache.values()] : [];
  res.json({
    tokenCount: users.length,
    serverCount: guilds.length,
    botTag: client?.user?.tag ?? "Not connected",
    botAvatar: client?.user?.displayAvatarURL({ size: 128 }) ?? null,
    servers: guilds.map((g) => ({
      id: g.id,
      name: g.name,
      memberCount: g.memberCount,
      icon: g.iconURL({ size: 64 }) ?? null,
    })),
  });
});

// ─── Users ────────────────────────────────────────────────────────────────────

router.get("/users", requireAuth, (_req: Request, res: Response) => {
  const users = readAuthUsers();
  res.json({ users: users.map((u) => ({ userId: u.userId })), total: users.length });
});

router.delete("/users/:userId", requireAuth, (req: Request, res: Response) => {
  const { userId } = req.params;
  deleteUserAuth(userId!);
  res.json({ success: true });
});

router.post("/check-tokens", requireAuth, async (_req: Request, res: Response) => {
  try {
    const embed = await doCheckTokens();
    const fields = embed.data.fields ?? [];
    const find = (name: string) => parseInt(fields.find((f) => f.name.includes(name))?.value ?? "0", 10);
    res.json({ valid: find("Valid"), refreshed: find("Refreshed"), invalid: find("Invalid"), total: find("Total") });
  } catch (err) {
    logger.error({ err }, "check-tokens error");
    res.status(500).json({ error: "Failed to check tokens" });
  }
});

router.post("/restock", requireAuth, async (req: Request, res: Response) => {
  const { tokens } = req.body as { tokens?: string };
  if (!tokens) { res.status(400).json({ error: "No tokens provided" }); return; }
  try {
    const embed = await doRestock(tokens);
    const fields = embed.data.fields ?? [];
    const find = (name: string) => parseInt(fields.find((f) => f.name.includes(name))?.value ?? "0", 10);
    res.json({ added: find("Added"), skipped: find("Skipped"), invalid: find("Invalid"), total: find("Total") });
  } catch (err) {
    logger.error({ err }, "restock error");
    res.status(500).json({ error: "Failed to restock" });
  }
});

// ─── Mass Join ────────────────────────────────────────────────────────────────

const activeJobs = new Map<string, { status: string; progress?: string; result?: Record<string, unknown>; error?: string }>();

router.post("/djoin", requireAuth, async (req: Request, res: Response) => {
  const client = getClient();
  if (!client) { res.status(503).json({ error: "Bot not connected" }); return; }
  const { serverId } = req.body as { serverId?: string };
  if (!serverId) { res.status(400).json({ error: "serverId is required" }); return; }

  const jobId = crypto.randomUUID();
  activeJobs.set(jobId, { status: "running", progress: "Starting..." });
  res.json({ jobId });

  doMassJoin(serverId, client, async (msg) => {
    const job = activeJobs.get(jobId);
    if (job) job.progress = msg;
  })
    .then((embed) => {
      const job = activeJobs.get(jobId);
      if (!job) return;
      if (embed) {
        const fields = embed.data.fields ?? [];
        const find = (name: string) => parseInt(fields.find((f) => f.name.includes(name))?.value ?? "0", 10);
        job.status = "done";
        job.result = {
          title: embed.data.title,
          added: find("Added"),
          failed: find("Failed"),
          refreshed: find("Refreshed"),
          total: find("Total"),
        };
      } else {
        job.status = "done";
        job.result = { title: "Complete", added: 0, failed: 0, refreshed: 0, total: 0 };
      }
    })
    .catch((err) => {
      logger.error({ err }, "djoin job error");
      const job = activeJobs.get(jobId);
      if (job) { job.status = "error"; job.error = String(err); }
    });
});

router.get("/djoin/:jobId", requireAuth, (req: Request, res: Response) => {
  const job = activeJobs.get(req.params.jobId!);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  res.json(job);
});

// ─── Servers ──────────────────────────────────────────────────────────────────

router.get("/servers", requireAuth, (_req: Request, res: Response) => {
  const client = getClient();
  if (!client) { res.status(503).json({ error: "Bot not connected" }); return; }
  const guilds = [...client.guilds.cache.values()].map((g) => ({
    id: g.id,
    name: g.name,
    memberCount: g.memberCount,
    icon: g.iconURL({ size: 64 }) ?? null,
    ownerId: g.ownerId,
  }));
  res.json({ servers: guilds });
});

// ─── Role limits ──────────────────────────────────────────────────────────────

router.get("/role-limits", requireAuth, (_req: Request, res: Response) => {
  res.json({ roleLimits: readRoleLimits() });
});

router.get("/role-limits/:guildId", requireAuth, (req: Request, res: Response) => {
  res.json({ limits: getGuildRoleLimits(req.params.guildId!) });
});

router.post("/role-limits", requireAuth, (req: Request, res: Response) => {
  const { guildId, roleId, limit } = req.body as { guildId?: string; roleId?: string; limit?: number };
  if (!guildId || !roleId || limit === undefined) {
    res.status(400).json({ error: "guildId, roleId, and limit are required" }); return;
  }
  const result = setGuildRoleLimit(guildId, roleId, limit);
  if (!result.ok) { res.status(400).json({ error: result.error }); return; }
  res.json({ success: true });
});

router.delete("/role-limits/:guildId/:roleId", requireAuth, (req: Request, res: Response) => {
  const removed = removeGuildRoleLimit(req.params.guildId!, req.params.roleId!);
  if (!removed) { res.status(404).json({ error: "Role limit not found" }); return; }
  res.json({ success: true });
});

// ─── Channel locks ────────────────────────────────────────────────────────────

router.get("/channels", requireAuth, (_req: Request, res: Response) => {
  res.json({ channelLocks: readChannelLocks() });
});

router.post("/channels", requireAuth, (req: Request, res: Response) => {
  const { guildId, type, channelId } = req.body as { guildId?: string; type?: string; channelId?: string };
  if (!guildId || !type || !channelId || !["djoin", "auth"].includes(type)) {
    res.status(400).json({ error: "guildId, type (djoin|auth), and channelId are required" }); return;
  }
  setChannelLock(guildId, type as "djoin" | "auth", channelId);
  res.json({ success: true });
});

router.delete("/channels/:guildId/:type", requireAuth, (req: Request, res: Response) => {
  const type = req.params.type as "djoin" | "auth";
  if (!["djoin", "auth"].includes(type)) { res.status(400).json({ error: "type must be djoin or auth" }); return; }
  const cleared = clearChannelLock(req.params.guildId!, type);
  if (!cleared) { res.status(404).json({ error: "No channel lock found" }); return; }
  res.json({ success: true });
});

// ─── Owners ───────────────────────────────────────────────────────────────────

router.get("/owners", requireAuth, (_req: Request, res: Response) => {
  const client = getClient();
  const guilds = client ? [...client.guilds.cache.values()] : [];
  const ownersData: Record<string, { guildName: string; ownerId: string; extraOwners: string[] }> = {};
  for (const guild of guilds) {
    ownersData[guild.id] = {
      guildName: guild.name,
      ownerId: guild.ownerId,
      extraOwners: getGuildExtraOwners(guild.id),
    };
  }
  res.json({ owners: ownersData });
});

router.post("/owners", requireAuth, (req: Request, res: Response) => {
  const { guildId, userId } = req.body as { guildId?: string; userId?: string };
  if (!guildId || !userId) { res.status(400).json({ error: "guildId and userId required" }); return; }
  addExtraOwner(guildId, userId);
  res.json({ success: true });
});

router.delete("/owners/:guildId/:userId", requireAuth, (req: Request, res: Response) => {
  removeExtraOwner(req.params.guildId!, req.params.userId!);
  res.json({ success: true });
});

export default router;
