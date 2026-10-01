import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setToken, formatApiError } from "@/lib/api";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = checking, false = anon, object = authed
  const [booting, setBooting] = useState(true);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem("sz_token");
    if (!token) { setUser(false); setBooting(false); return; }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setToken(null);
      setUser(false);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  const login = async (identifier, password) => {
    const { data } = await api.post("/auth/login", { identifier, password });
    setToken(data.access_token);
    if (data.refresh_token) localStorage.setItem("sz_refresh", data.refresh_token);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    setToken(data.access_token);
    if (data.refresh_token) localStorage.setItem("sz_refresh", data.refresh_token);
    setUser(data.user);
    return data;
  };

  const refreshUser = loadMe;

  const logout = async () => {
    try { await api.post("/auth/logout", {}); } catch {}
    setToken(null);
    localStorage.removeItem("sz_refresh");
    setUser(false);
  };

  return (
    <AuthCtx.Provider value={{ user, booting, login, register, logout, refreshUser, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export { formatApiError };
