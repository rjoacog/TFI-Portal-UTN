import { createContext } from 'react';

/** Placeholder: el issue de inicio de sesión define los campos reales. */
export type SessionUser = Record<string, never>;

export interface SessionContextValue {
  user: SessionUser | null;
  clearSession: () => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);
