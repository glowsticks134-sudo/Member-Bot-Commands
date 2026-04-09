import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Stats {
  tokenCount: number;
  serverCount: number;
  botTag: string;
  botAvatar: string | null;
  servers: { id: string; name: string; memberCount: number; icon: string | null }[];
}

export default function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getStats()
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Bot status and summary</p>
      </div>

      {error && <ErrorBanner message={error} />}

      {stats && (
        <>
          {/* Bot info */}
          <div className="bg-card border border-border rounded-xl p-4 mb-6 flex items-center gap-4">
            {stats.botAvatar ? (
              <img src={stats.botAvatar} alt="Bot" className="w-12 h-12 rounded-full" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-2xl">🤖</div>
            )}
            <div>
              <div className="font-bold text-foreground">{stats.botTag}</div>
              <div className="text-sm text-green-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse" />
                Online
              </div>
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <StatCard icon="🔑" label="Stored Tokens" value={stats.tokenCount.toLocaleString()} color="text-primary" />
            <StatCard icon="🌐" label="Servers" value={stats.serverCount.toLocaleString()} color="text-green-400" />
            <StatCard icon="👥" label="Avg Members" value={stats.servers.length > 0 ? Math.round(stats.servers.reduce((a, s) => a + s.memberCount, 0) / stats.servers.length).toLocaleString() : "—"} color="text-yellow-400" />
          </div>

          {/* Recent servers */}
          {stats.servers.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <h2 className="font-semibold text-foreground text-sm">Bot Servers</h2>
              </div>
              <div className="divide-y divide-border">
                {stats.servers.slice(0, 8).map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                    {s.icon ? (
                      <img src={s.icon} alt={s.name} className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground">
                        {s.name[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{s.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{s.id}</div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">{s.memberCount.toLocaleString()} members</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-2xl mb-2">{icon}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function PageLoader() {
  return (
    <div className="p-6 flex items-center justify-center min-h-64">
      <div className="text-muted-foreground animate-pulse">Loading...</div>
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
