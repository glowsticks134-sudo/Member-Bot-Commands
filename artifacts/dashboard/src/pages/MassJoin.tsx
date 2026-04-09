import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";

export default function MassJoin() {
  const [serverId, setServerId] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<{ title: string; added: number; failed: number; refreshed: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, []);

  async function poll(jid: string) {
    try {
      const r = await api.getDjoinJob(jid);
      if (r.status === "running") {
        setProgress(r.progress ?? "Running...");
        pollRef.current = setTimeout(() => poll(jid), 2000);
      } else if (r.status === "done") {
        setStatus("done");
        setResult(r.result ?? null);
      } else {
        setStatus("error");
        setError(r.error ?? "Unknown error");
      }
    } catch (e: unknown) {
      setStatus("error");
      setError((e as Error).message);
    }
  }

  async function handleStart() {
    if (!serverId.trim()) return;
    setStatus("running");
    setResult(null);
    setError("");
    setProgress("Starting...");
    try {
      const { jobId: jid } = await api.startDjoin(serverId.trim());
      setJobId(jid);
      pollRef.current = setTimeout(() => poll(jid), 2000);
    } catch (e: unknown) {
      setStatus("error");
      setError((e as Error).message);
    }
  }

  function handleReset() {
    if (pollRef.current) clearTimeout(pollRef.current);
    setStatus("idle");
    setJobId(null);
    setProgress("");
    setResult(null);
    setError("");
    setServerId("");
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Mass Join</h1>
        <p className="text-muted-foreground text-sm mt-1">Add all authenticated users to a Discord server</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        {status === "idle" && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Target Server ID</label>
              <input
                type="text"
                value={serverId}
                onChange={(e) => setServerId(e.target.value)}
                placeholder="Enter Discord Server ID..."
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                The bot must be in the target server before running mass join.
              </p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 text-sm text-yellow-400">
              ⚠️ This operation adds <strong>all authenticated users</strong> to the target server. This may take several minutes and cannot be stopped once started.
            </div>
            <button
              onClick={handleStart}
              disabled={!serverId.trim()}
              className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-lg text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              🚀 Start Mass Join
            </button>
          </div>
        )}

        {status === "running" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-sm font-medium text-foreground">Mass Join in Progress</span>
            </div>
            <div className="bg-muted rounded-lg p-4 font-mono text-sm text-foreground whitespace-pre-wrap min-h-[80px]">
              {progress || "Initializing..."}
            </div>
            <p className="text-xs text-muted-foreground">Job ID: <code className="font-mono">{jobId}</code></p>
          </div>
        )}

        {status === "done" && result && (
          <div className="space-y-4">
            <div className="text-center text-2xl">✅</div>
            <h3 className="text-center font-bold text-foreground">{result.title}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xl font-bold text-green-400">{result.added}</div>
                <div className="text-xs text-muted-foreground">Added</div>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xl font-bold text-destructive">{result.failed}</div>
                <div className="text-xs text-muted-foreground">Failed</div>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xl font-bold text-blue-400">{result.refreshed}</div>
                <div className="text-xs text-muted-foreground">Refreshed</div>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="text-xl font-bold text-foreground">{result.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
            </div>
            <button onClick={handleReset} className="w-full bg-secondary text-secondary-foreground py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-all">
              Run Another
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
              ❌ {error}
            </div>
            <button onClick={handleReset} className="w-full bg-secondary text-secondary-foreground py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-all">
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
