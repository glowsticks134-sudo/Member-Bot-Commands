export interface DjoinJob {
  serverId: string;
  serverName: string;
  requestedBy: string;
  startedAt: Date;
  total: number;
  done: number;
  status: "running" | "done" | "failed";
}

const activeJobs = new Map<string, DjoinJob>();
const cooldowns = new Map<string, number>();

export const DJOIN_COOLDOWN_MS = 180_000;

export function startDjoinJob(job: DjoinJob): void {
  activeJobs.set(job.serverId, job);
}

export function updateDjoinJob(serverId: string, done: number, total: number): void {
  const j = activeJobs.get(serverId);
  if (j) { j.done = done; j.total = total; }
}

export function finishDjoinJob(serverId: string, status: "done" | "failed"): void {
  const j = activeJobs.get(serverId);
  if (j) {
    j.status = status;
    setTimeout(() => activeJobs.delete(serverId), 60_000);
  }
}

export function getActiveJobs(): DjoinJob[] {
  return [...activeJobs.values()];
}

export function isJobRunning(serverId: string): boolean {
  return activeJobs.get(serverId)?.status === "running";
}

export function checkCooldown(userId: string, serverId: string): number {
  const key = `${userId}:${serverId}`;
  const expires = cooldowns.get(key) ?? 0;
  const remaining = expires - Date.now();
  return remaining > 0 ? remaining : 0;
}

export function setCooldown(userId: string, serverId: string): void {
  cooldowns.set(`${userId}:${serverId}`, Date.now() + DJOIN_COOLDOWN_MS);
}
