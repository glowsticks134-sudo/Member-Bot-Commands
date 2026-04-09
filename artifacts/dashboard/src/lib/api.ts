const API_BASE = "/api/dashboard";

function getToken(): string | null {
  return localStorage.getItem("dashboard_token");
}

export function setToken(token: string) {
  localStorage.setItem("dashboard_token", token);
}

export function clearToken() {
  localStorage.removeItem("dashboard_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    clearToken();
    window.location.reload();
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error((err as { error: string }).error || "Request failed");
  }
  return res.json() as Promise<T>;
}

export const api = {
  login: (botToken: string) =>
    request<{ token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ botToken }),
    }),

  verifyToken: (token: string) =>
    request<{ valid: boolean }>("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  getStats: () =>
    request<{
      tokenCount: number;
      serverCount: number;
      botTag: string;
      botAvatar: string | null;
      servers: { id: string; name: string; memberCount: number; icon: string | null }[];
    }>("/stats"),

  getUsers: () =>
    request<{ users: { userId: string }[]; total: number }>("/users"),

  deleteUser: (userId: string) =>
    request<{ success: boolean }>(`/users/${userId}`, { method: "DELETE" }),

  checkTokens: () =>
    request<{ valid: number; refreshed: number; invalid: number; total: number }>("/check-tokens", { method: "POST" }),

  restock: (tokens: string) =>
    request<{ added: number; skipped: number; invalid: number; total: number }>("/restock", {
      method: "POST",
      body: JSON.stringify({ tokens }),
    }),

  startDjoin: (serverId: string) =>
    request<{ jobId: string }>("/djoin", {
      method: "POST",
      body: JSON.stringify({ serverId }),
    }),

  getDjoinJob: (jobId: string) =>
    request<{
      status: "running" | "done" | "error";
      progress?: string;
      result?: { title: string; added: number; failed: number; refreshed: number; total: number };
      error?: string;
    }>(`/djoin/${jobId}`),

  getServers: () =>
    request<{ servers: { id: string; name: string; memberCount: number; icon: string | null; ownerId: string }[] }>(
      "/servers"
    ),

  getRoleLimits: () =>
    request<{ roleLimits: Record<string, Record<string, number>> }>("/role-limits"),

  setRoleLimit: (guildId: string, roleId: string, limit: number) =>
    request<{ success: boolean }>("/role-limits", {
      method: "POST",
      body: JSON.stringify({ guildId, roleId, limit }),
    }),

  deleteRoleLimit: (guildId: string, roleId: string) =>
    request<{ success: boolean }>(`/role-limits/${guildId}/${roleId}`, { method: "DELETE" }),

  getChannels: () =>
    request<{ channelLocks: Record<string, { djoin?: string; auth?: string }> }>("/channels"),

  setChannel: (guildId: string, type: "djoin" | "auth", channelId: string) =>
    request<{ success: boolean }>("/channels", {
      method: "POST",
      body: JSON.stringify({ guildId, type, channelId }),
    }),

  clearChannel: (guildId: string, type: "djoin" | "auth") =>
    request<{ success: boolean }>(`/channels/${guildId}/${type}`, { method: "DELETE" }),

  getOwners: () =>
    request<{
      owners: Record<string, { guildName: string; ownerId: string; extraOwners: string[] }>;
    }>("/owners"),

  addOwner: (guildId: string, userId: string) =>
    request<{ success: boolean }>("/owners", {
      method: "POST",
      body: JSON.stringify({ guildId, userId }),
    }),

  removeOwner: (guildId: string, userId: string) =>
    request<{ success: boolean }>(`/owners/${guildId}/${userId}`, { method: "DELETE" }),
};
