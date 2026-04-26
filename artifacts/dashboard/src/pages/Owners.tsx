import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface GuildOwners {
  guildName: string;
  ownerId: string;
  ownerRoles: string[];
}

export default function Owners() {
  const [owners, setOwners] = useState<Record<string, GuildOwners>>({});
  const [globalOwners, setGlobalOwners] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedGuild, setSelectedGuild] = useState("");

  function load() {
    api.getOwners()
      .then((r) => {
        setOwners(r.owners);
        setGlobalOwners(r.globalOwners);
        if (!selectedGuild && Object.keys(r.owners).length > 0) {
          setSelectedGuild(Object.keys(r.owners)[0]!);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const guilds = Object.entries(owners);
  const current = selectedGuild ? owners[selectedGuild] : null;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Owner Access</h1>
        <p className="text-muted-foreground text-sm mt-1">View who has owner-level access to bot commands</p>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Global owners */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <div className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">
          Global Owners ({globalOwners.length}) — full access in every server
        </div>
        {globalOwners.length === 0 ? (
          <div className="text-sm text-muted-foreground">None configured</div>
        ) : (
          <div className="space-y-2">
            {globalOwners.map((uid) => (
              <div key={uid} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-base shrink-0">⭐</div>
                <span className="flex-1 text-sm font-mono text-foreground">{uid}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          To change this list, edit <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">HARDCODED_OWNERS</code> in{" "}
          <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">artifacts/api-server/src/bot/index.ts</code> and redeploy.
        </p>
      </div>

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

          {/* Owner roles for this guild */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="font-semibold text-foreground text-sm">Owner Roles ({current.ownerRoles.length})</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Anyone with one of these roles in this server gets owner access. Manage with{" "}
                <code className="bg-muted px-1 py-0.5 rounded">/setowner_role</code> and{" "}
                <code className="bg-muted px-1 py-0.5 rounded">/removeowner_role</code> in Discord.
              </p>
            </div>
            {current.ownerRoles.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">No owner roles configured for this server</div>
            ) : (
              <div className="divide-y divide-border">
                {current.ownerRoles.map((rid) => (
                  <div key={rid} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-base shrink-0">🛡️</div>
                    <span className="flex-1 text-sm font-mono text-foreground">{rid}</span>
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
