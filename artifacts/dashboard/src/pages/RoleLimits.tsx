import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Server {
  id: string;
  name: string;
  icon: string | null;
}

export default function RoleLimits() {
  const [roleLimits, setRoleLimits] = useState<Record<string, Record<string, number>>>({});
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedGuild, setSelectedGuild] = useState("");
  const [roleId, setRoleId] = useState("");
  const [limit, setLimit] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  function load() {
    Promise.all([api.getRoleLimits(), api.getServers()])
      .then(([rl, sv]) => {
        setRoleLimits(rl.roleLimits);
        setServers(sv.servers);
        if (!selectedGuild && sv.servers.length > 0) setSelectedGuild(sv.servers[0]!.id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!selectedGuild || !roleId.trim() || !limit.trim()) return;
    const num = parseInt(limit, 10);
    if (isNaN(num) || num < 1) { setAddError("Limit must be a positive number"); return; }
    setAdding(true);
    setAddError("");
    try {
      await api.setRoleLimit(selectedGuild, roleId.trim(), num);
      setRoleId("");
      setLimit("");
      load();
    } catch (e: unknown) {
      setAddError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(guildId: string, rid: string) {
    if (!confirm(`Remove limit for role ${rid}?`)) return;
    try {
      await api.deleteRoleLimit(guildId, rid);
      load();
    } catch (e: unknown) {
      alert((e as Error).message);
    }
  }

  const guildLimits = selectedGuild ? (roleLimits[selectedGuild] ?? {}) : {};
  const entries = Object.entries(guildLimits);
  const MAX = 10;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Role Limits</h1>
        <p className="text-muted-foreground text-sm mt-1">Control how many members each role can mass-join (max {MAX} roles per server)</p>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Guild selector */}
      {servers.length > 1 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-1.5">Server</label>
          <select
            value={selectedGuild}
            onChange={(e) => setSelectedGuild(e.target.value)}
            className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 w-full max-w-xs"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Add role limit */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <h2 className="font-semibold text-foreground text-sm mb-3">
          ➕ Add Role Limit
          <span className="text-muted-foreground font-normal ml-2">({entries.length}/{MAX} used)</span>
        </h2>
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            placeholder="Role ID (e.g. 1234567890)"
            className="flex-1 min-w-40 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
          />
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="Limit (e.g. 10)"
            min={1}
            max={50000}
            className="w-32 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !selectedGuild || !roleId.trim() || !limit.trim() || entries.length >= MAX}
            className="bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </div>
        {addError && <p className="text-destructive text-xs mt-2">{addError}</p>}
        {entries.length >= MAX && (
          <p className="text-yellow-400 text-xs mt-2">Maximum of {MAX} roles reached. Remove one before adding another.</p>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Right-click a role in Discord → Copy ID to get the Role ID. Users with this role can join up to the limit number of members.
        </p>
      </div>

      {/* Current limits */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-foreground text-sm">
            {selectedGuild ? servers.find((s) => s.id === selectedGuild)?.name ?? "Server" : "Select a server"} — Role Limits
          </h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No role limits configured for this server.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {entries.map(([rid, lim]) => (
              <div key={rid} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono text-foreground">{rid}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Role ID</div>
                </div>
                <div className="text-primary font-bold text-sm">{lim.toLocaleString()} members</div>
                <button
                  onClick={() => handleRemove(selectedGuild, rid)}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded hover:bg-destructive/10"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm mb-4">
      {message}
    </div>
  );
}
