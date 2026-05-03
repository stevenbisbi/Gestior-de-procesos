import { createContext, useContext, useState, useEffect } from 'react';
import { Auth, getToken, setToken, clearToken } from './api';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    Auth.me()
      .then(d => setUser({ ...d.user, is_supervisor: d.is_supervisor,
                           machines: d.machines, process_types: d.process_types }))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const data = await Auth.login(username, password);
    setToken(data.token);
    const me = await Auth.me();
    setUser({ ...me.user, is_supervisor: me.is_supervisor,
              machines: me.machines, process_types: me.process_types });
    return data;
  };

  const logout = async () => {
    try { await Auth.logout(); } catch {}
    clearToken();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}
