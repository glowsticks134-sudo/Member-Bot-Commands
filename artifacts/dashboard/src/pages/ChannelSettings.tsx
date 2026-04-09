import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Server {
  id: string;
  name: string;
  icon: string | null;
}

export default function ChannelSettings() {
  const [channelLocks, setChannelLocks] = useState<Record<string, { djoin?: string; auth?: string }>>({});
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedGuild, setSelectedGuild] = useState("");
  const [djoinChannel, setDjoinChannel] = useState("");
  const [authChannel, setAuthChannel] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  function load() {
    Promise.all([api.getChannels(), api.getServers()])
      .then(([cl, sv]) => {
        setChannelLocks(cl.channelLocks);
        setServers(sv.servers);
        if (!selectedGuild && sv.servers.length > 0) {
          const firstId = sv.servers[0]!.id;
          setSelectedGuild(firstId);
          const locks = cl.channelLocks[firstId] ?? {};
          setDjoinChannel(locks.djoin ?? "");
          setAuthChannel(locks.auth ?? "");
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function handleGuildChange(guildId: string) {
    setSelectedGuild(guildId);
    const locks = channelLocks[guildId] ?? {};
    setDjoinChannel(locks.djoin ?? "");
    setAuthChannel(locks.auth ?? "");
  }

  async function handleSet(type: "djoin" | "auth", channelId: string) {
    if (!selectedGuild || !channelId.trim()) return;
    setSaving(type);
    try {
      await api.setChannel(selectedGuild, type, channelId.trim());
      load();
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setSaving(null);
    }
  }

  async function handleClear(type: "djoin" | "auth") {
    if (!selectedGuild) return;
    setSaving(`clear-${type}`);
    try {
      await api.clearChannel(selectedGuild, type);
      if (type === "djoin") setDjoinChannel("");
      else setAuthChannel("");
      load();
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setSaving(null);
    }
  }

  const currentLocks = selectedGuild ? (channelLocks[selectedGuild] ?? {}) : {};

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Channel Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Restrict commands to specific channels per server</p>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Guild selector */}
      {servers.length > 1 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-foreground mb-1.5">Server</label>
          <select
            value={selectedGuild}
            onChange={(e) => handleGuildChange(e.target.value)}
            className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 w-full max-w-xs"
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="text-center text-muted-foreground py-12 animate-pulse">Loading...</div>
      ) : (
        <div className="space-y-4">
          <ChannelLockCard
            type="djoin"
            icon="🚀"
            label="djoin Channel Lock"
            description="Restrict the mass join command to a specific channel. Users running it elsewhere will be redirected."
            value={djoinChannel}
            onChange={setDjoinChannel}
            lockedTo={currentLocks.djoin}
            saving={saving === "djoin"}
            clearing={saving === "clear-djoin"}
            onSet={() => handleSet("djoin", djoinChannel)}
            onClear={() => handleClear("djoin")}
          />
          <ChannelLockCard
            type="auth"
            icon="🔐"
            label="auth Channel Lock"
            description="Restrict the authentication command to a specific channel."
            value={authChannel}
            onChange={setAuthChannel}
            lockedTo={currentLocks.auth}
            saving={saving === "auth"}
            clearing={saving === "clear-auth"}
            onSet={() => handleSet("auth", authChannel)}
            onClear={() => handleClear("auth")}
          />
        </div>
      )}
    </div>
  );
}

interface ChannelLockCardProps {
  type: string;
  icon: string;
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  lockedTo?: string;
  saving: boolean;
  clearing: boolean;
  onSet: () => void;
  onClear: () => void;
}

function ChannelLockCard({ icon, label, description, value, onChange, lockedTo, saving, clearing, onSet, onClear }: ChannelLockCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <span className="text-xl">{icon}</span>
        <div>
          <h3 className="font-semibold text-foreground text-sm">{label}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>

      {lockedTo && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-sm text-primary mb-3 flex items-center justify-between">
          <span>📌 Currently locked to channel ID: <code className="font-mono">{lockedTo}</code></span>
          <button
            onClick={onClear}
            disabled={clearing}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors ml-3 shrink-0"
          >
            {clearing ? "..." : "Clear"}
          </button>
        </div>
      )}

      <div className="flex gap-3">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Channel ID (right-click channel → Copy ID)"
          className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
        />
        <button
          onClick={onSet}
          disabled={saving || !value.trim()}
          className="bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {saving ? "Saving..." : lockedTo ? "Update" : "Set Lock"}
        </button>
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
