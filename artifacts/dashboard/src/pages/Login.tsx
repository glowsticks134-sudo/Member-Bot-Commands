import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/App";

export default function Login() {
  const { login } = useAuth();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.login(token.trim());
      login(res.token);
    } catch (err) {
      setError("Invalid bot token. Please check and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🤖</div>
          <h1 className="text-2xl font-bold text-foreground">Members Bot</h1>
          <p className="text-muted-foreground mt-1 text-sm">Owner Dashboard</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-xl">
          <h2 className="text-foreground font-semibold mb-1">Sign In</h2>
          <p className="text-muted-foreground text-sm mb-5">
            Enter your Discord Bot Token to access the dashboard.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Bot Token
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your bot token..."
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors font-mono"
                autoComplete="off"
              />
            </div>

            {error && (
              <div className="text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !token.trim()}
              className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-lg text-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Authenticating..." : "Access Dashboard"}
            </button>
          </form>

          <p className="text-xs text-muted-foreground mt-4 text-center">
            Find your token at{" "}
            <a
              href="https://discord.com/developers/applications"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Discord Developer Portal
            </a>{" "}
            → Bot → Token
          </p>
        </div>
      </div>
    </div>
  );
}
