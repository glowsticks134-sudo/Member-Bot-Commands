import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { api, setToken as storeToken, clearToken } from "@/lib/api";
import Login from "@/pages/Login";
import Layout from "@/pages/Layout";
import Overview from "@/pages/Overview";
import Users from "@/pages/Users";
import MassJoin from "@/pages/MassJoin";
import Servers from "@/pages/Servers";
import RoleLimits from "@/pages/RoleLimits";
import ChannelSettings from "@/pages/ChannelSettings";
import Owners from "@/pages/Owners";

interface AuthContextType {
  isAuthed: boolean;
  login: (token: string) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthed: false,
  login: () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function AppRoutes() {
  const { isAuthed } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAuthed) navigate("/login");
  }, [isAuthed, navigate]);

  if (!isAuthed) return <Login />;

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Overview} />
        <Route path="/login" component={Overview} />
        <Route path="/users" component={Users} />
        <Route path="/mass-join" component={MassJoin} />
        <Route path="/servers" component={Servers} />
        <Route path="/role-limits" component={RoleLimits} />
        <Route path="/channels" component={ChannelSettings} />
        <Route path="/owners" component={Owners} />
        <Route>
          <div className="p-8 text-muted-foreground">Page not found.</div>
        </Route>
      </Switch>
    </Layout>
  );
}

export default function App() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("dashboard_token");
    if (!token) { setChecking(false); return; }
    api.verifyToken(token)
      .then((r) => { if (r.valid) setIsAuthed(true); })
      .catch(() => { clearToken(); })
      .finally(() => setChecking(false));
  }, []);

  const login = useCallback((token: string) => {
    storeToken(token);
    setIsAuthed(true);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setIsAuthed(false);
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthed, login, logout }}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AppRoutes />
      </WouterRouter>
    </AuthContext.Provider>
  );
}
