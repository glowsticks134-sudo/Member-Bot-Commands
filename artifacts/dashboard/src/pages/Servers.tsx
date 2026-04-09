import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Server {
  id: string;
  name: string;
  memberCount: number;
  icon: string | null;
  ownerId: string;
}

export default function Servers() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    api.getServers()
      .then((r) => setServers(r.servers))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const filtered = search.trim()
    ? servers.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.id.includes(search))
    : servers;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Servers</h1>
          <p className="text-muted-foreground text-sm mt-1">{servers.length} server{servers.length !== 1 ? "s" : ""} the bot is in</p>
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search servers..."
          className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 w-52"
        />
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <div className="text-center text-muted-foreground py-12 animate-pulse">Loading...</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((s) => (
            <div key={s.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              {s.icon ? (
                <img src={s.icon} alt={s.name} className="w-12 h-12 rounded-full shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground shrink-0">
                  {s.name[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground truncate">{s.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.memberCount.toLocaleString()} members</div>
                <button
                  onClick={() => copy(s.id)}
                  className="mt-1 text-xs font-mono text-muted-foreground hover:text-primary transition-colors"
                  title="Copy ID"
                >
                  {copied === s.id ? "✅ Copied!" : `${s.id}`}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center text-muted-foreground py-12">No servers found</div>
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
