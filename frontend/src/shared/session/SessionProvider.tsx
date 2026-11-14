import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { setUnauthorizedHandler } from '../api';
import { SessionContext, type SessionContextValue, type SessionUser } from './session-context';

export function SessionProvider({ children }: { children: ReactNode }) {
  // Por ahora el usuario es siempre null: la carga del usuario es del issue de inicio de sesión.
  const [user, setUser] = useState<SessionUser | null>(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    // Ante un 401 el cliente limpia la sesión y redirige a /login (salvo que ya esté ahí).
    return setUnauthorizedHandler(() => {
      setUser(null);
      if (pathname !== '/login') navigate('/login', { replace: true });
    });
  }, [navigate, pathname]);

  const value = useMemo<SessionContextValue>(
    () => ({ user, clearSession: () => setUser(null) }),
    [user],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
