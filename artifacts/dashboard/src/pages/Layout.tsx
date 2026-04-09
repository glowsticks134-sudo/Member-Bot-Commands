import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/App";

const NAV = [
  { path: "/", icon: "📊", label: "Overview" },
  { path: "/users", icon: "👥", label: "Users" },
  { path: "/mass-join", icon: "🚀", label: "Mass Join" },
  { path: "/servers", icon: "🌐", label: "Servers" },
  { path: "/role-limits", icon: "🎭", label: "Role Limits" },
  { path: "/channels", icon: "📌", label: "Channels" },
  { path: "/owners", icon: "👑", label: "Owners" },
];

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-56 flex-col bg-card border-r border-border fixed h-full z-20">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🤖</span>
            <div>
              <div className="text-sm font-bold text-foreground">Members Bot</div>
              <div className="text-xs text-muted-foreground">Owner Dashboard</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const active = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full transition-colors"
          >
            <span>🚪</span> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <span className="font-bold text-sm text-foreground">Members Bot</span>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="text-foreground p-1">
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-20 bg-background/95 backdrop-blur pt-14">
          <nav className="p-4 space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <span>{item.icon}</span> {item.label}
              </Link>
            ))}
            <button
              onClick={() => { logout(); setMenuOpen(false); }}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-destructive hover:bg-destructive/10 w-full"
            >
              <span>🚪</span> Sign Out
            </button>
          </nav>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-56 pt-14 md:pt-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
