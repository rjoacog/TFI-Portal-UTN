import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { api, setPasswordChangeHandler, setUnauthorizedHandler } from '../api';
import {
  SessionContext,
  type SessionContextValue,
  type SessionStatus,
  type SessionUser,
} from './session-context';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const navigate = useNavigate();

  const setUser = useCallback((next: SessionUser) => {
    setUserState(next);
    setStatus('authenticated');
  }, []);

  const clearSession = useCallback(() => {
    setUserState(null);
    setStatus('anonymous');
  }, []);

  // Ante un 401 solo se limpia la sesión: `RequireAuth` redirige a `/login` y recuerda la ruta.
  useEffect(() => setUnauthorizedHandler(clearSession), [clearSession]);

  // Ante un 403 `PASSWORD_CHANGE_REQUIRED` se marca el cambio pendiente y se redirige.
  useEffect(
    () =>
      setPasswordChangeHandler(() => {
        setUserState((current) => (current ? { ...current, mustChangePassword: true } : current));
        navigate('/change-password', { replace: true });
      }),
    [navigate],
  );

  // Al cargar la página, recupera la sesión desde la cookie.
  useEffect(() => {
    const controller = new AbortController();
    api
      .get<{ user: SessionUser }>('/api/auth/me', controller.signal)
      .then(({ user: me }) => setUser(me))
      .catch(() => {
        // 401, API apagada o error de red: sin sesión. El formulario de ingreso muestra el resto.
        if (!controller.signal.aborted) clearSession();
      });
    return () => controller.abort();
  }, [setUser, clearSession]);

  const value = useMemo<SessionContextValue>(
    () => ({ user, status, setUser, clearSession }),
    [user, status, setUser, clearSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
