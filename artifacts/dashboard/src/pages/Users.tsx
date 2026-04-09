import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function Users() {
  const [users, setUsers] = useState<{ userId: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkResult, setCheckResult] = useState<{ valid: number; refreshed: number; invalid: number; total: number } | null>(null);
  const [checking, setChecking] = useState(false);
  const [restockText, setRestockText] = useState("");
  const [restockResult, setRestockResult] = useState<{ added: number; skipped: number; invalid: number; total: number } | null>(null);
  const [restocking, setRestocking] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  function load() {
    setLoading(true);
    api.getUsers()
      .then((r) => { setUsers(r.users); setTotal(r.total); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(userId: string) {
    if (!confirm(`Remove token for user ${userId}?`)) return;
    setDeletingId(userId);
    try {
      await api.deleteUser(userId);
      setUsers((u) => u.filter((x) => x.userId !== userId));
      setTotal((t) => t - 1);
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCheck() {
    setChecking(true);
    setCheckResult(null);
    try {
      const r = await api.checkTokens();
      setCheckResult(r);
      load();
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setChecking(false);
    }
  }

  async function handleRestock() {
    if (!restockText.trim()) return;
    setRestocking(true);
    setRestockResult(null);
    try {
      const r = await api.restock(restockText.trim());
      setRestockResult(r);
      setRestockText("");
      load();
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setRestocking(false);
    }
  }

  const filtered = search.trim()
    ? users.filter((u) => u.userId.includes(search.trim()))
    : users;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-muted-foreground text-sm mt-1">{total} authenticated tokens stored</p>
        </div>
        <button
          onClick={handleCheck}
          disabled={checking}
          className="bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {checking ? "Checking..." : "🔍 Validate All Tokens"}
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Check tokens result */}
      {checkResult && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4 grid grid-cols-4 gap-4 text-center">
          <div><div className="text-xl font-bold text-green-400">{checkResult.valid}</div><div className="text-xs text-muted-foreground">Valid</div></div>
          <div><div className="text-xl font-bold text-blue-400">{checkResult.refreshed}</div><div className="text-xs text-muted-foreground">Refreshed</div></div>
          <div><div className="text-xl font-bold text-destructive">{checkResult.invalid}</div><div className="text-xs text-muted-foreground">Invalid</div></div>
          <div><div className="text-xl font-bold text-foreground">{checkResult.total}</div><div className="text-xs text-muted-foreground">Total</div></div>
        </div>
      )}

      {/* Restock */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6">
        <h2 className="font-semibold text-foreground text-sm mb-3">🔄 Restock Tokens</h2>
        <p className="text-xs text-muted-foreground mb-3">Paste tokens (one per line): <code className="bg-muted px-1 rounded font-mono">userId,accessToken,refreshToken</code></p>
        <textarea
          value={restockText}
          onChange={(e) => setRestockText(e.target.value)}
          rows={4}
          placeholder="userId,accessToken,refreshToken&#10;userId,accessToken,refreshToken"
          className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono resize-none"
        />
        {restockResult && (
          <div className="mt-2 grid grid-cols-4 gap-3 text-center text-sm">
            <div className="text-green-400 font-bold">{restockResult.added} added</div>
            <div className="text-yellow-400 font-bold">{restockResult.skipped} skipped</div>
            <div className="text-destructive font-bold">{restockResult.invalid} invalid</div>
            <div className="text-foreground font-bold">{restockResult.total} total</div>
          </div>
        )}
        <button
          onClick={handleRestock}
          disabled={restocking || !restockText.trim()}
          className="mt-3 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {restocking ? "Adding..." : "Add Tokens"}
        </button>
      </div>

      {/* Users list */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-3">
          <h2 className="font-semibold text-foreground text-sm flex-1">Token List</h2>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user ID..."
            className="bg-muted border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 w-48"
          />
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No users found</div>
        ) : (
          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {filtered.map((u) => (
              <div key={u.userId} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground font-bold shrink-0">
                  {u.userId[0]}
                </div>
                <span className="flex-1 text-sm font-mono text-foreground">{u.userId}</span>
                <button
                  onClick={() => handleDelete(u.userId)}
                  disabled={deletingId === u.userId}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded hover:bg-destructive/10"
                >
                  {deletingId === u.userId ? "..." : "Remove"}
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
