import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface GuildOwners {
  guildName: string;
  ownerId: string;
  extraOwners: string[];
}

export default function Owners() {
  const [owners, setOwners] = useState<Record<string, GuildOwners>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedGuild, setSelectedGuild] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  function load() {
    api.getOwners()
      .then((r) => {
        setOwners(r.owners);
        if (!selectedGuild && Object.keys(r.owners).length > 0) {
          setSelectedGuild(Object.keys(r.owners)[0]!);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleAdd() {
    if (!selectedGuild || !newUserId.trim()) return;
    setAdding(true);
    setAddError("");
    try {
      await api.addOwner(selectedGuild, newUserId.trim());
      setNewUserId("");
      load();
    } catch (e: unknown) {
      setAddError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(userId: string) {
    if (!selectedGuild) return;
    if (!confirm(`Remove owner access from user ${userId}?`)) return;
    setRemovingId(userId);
    try {
      await api.removeOwner(selectedGuild, userId);
      load();
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setRemovingId(null);
    }
  }

  const guilds = Object.entries(owners);
  const current = selectedGuild ? owners[selectedGuild] : null;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Owner Management</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage who has owner-level access to bot commands per server</p>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Guild selector */}
      {guilds.length > 1 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-1.5">Server</label>
          <select
            value={selectedGuild}
            onChange={(e) => setSelectedGuild(e.target.value)}
            className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 w-full max-w-xs"
          >
            {guilds.map(([id, g]) => (
              <option key={id} value={id}>{g.guildName}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="text-center text-muted-foreground py-12 animate-pulse">Loading...</div>
      ) : !current ? (
        <div className="text-center text-muted-foreground py-12">No servers found</div>
      ) : (
        <>
          {/* Server owner */}
          <div className="bg-card border border-border rounded-xl p-4 mb-4">
            <div className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Server Owner (Permanent)</div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-base">👑</div>
              <div>
                <div className="text-sm font-mono text-foreground">{current.ownerId}</div>
                <div className="text-xs text-muted-foreground">Cannot be removed</div>
              </div>
            </div>
          </div>

          {/* Add extra owner */}
          <div className="bg-card border border-border rounded-xl p-4 mb-4">
            <h2 className="font-semibold text-foreground text-sm mb-3">⭐ Add Extra Owner</h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                placeholder="Discord User ID"
                className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
              />
              <button
                onClick={handleAdd}
                disabled={adding || !newUserId.trim()}
                className="bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
              >
                {adding ? "Adding..." : "Add"}
              </button>
            </div>
            {addError && <p className="text-destructive text-xs mt-2">{addError}</p>}
            <p className="text-xs text-muted-foreground mt-2">Extra owners can use all owner-level bot commands in this server.</p>
          </div>

          {/* Extra owners list */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="font-semibold text-foreground text-sm">Extra Owners ({current.extraOwners.length})</h2>
            </div>
            {current.extraOwners.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No extra owners added yet</div>
            ) : (
              <div className="divide-y divide-border">
                {current.extraOwners.map((uid) => (
                  <div key={uid} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-base shrink-0">⭐</div>
                    <span className="flex-1 text-sm font-mono text-foreground">{uid}</span>
                    <button
                      onClick={() => handleRemove(uid)}
                      disabled={removingId === uid}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded hover:bg-destructive/10"
                    >
                      {removingId === uid ? "..." : "Remove"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
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
