import { createContext } from 'react';

export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN' | 'DIRECTOR';

/** Usuario de la sesión, tal como lo devuelve `GET /api/auth/me`. */
export interface SessionUser {
  id: number;
  loginId: string;
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
  mustChangePassword: boolean;
}

/** `loading` mientras se consulta la sesión al cargar la página. */
export type SessionStatus = 'loading' | 'authenticated' | 'anonymous';

export interface SessionContextValue {
  user: SessionUser | null;
  status: SessionStatus;
  /** Guarda el usuario (por ejemplo, después de iniciar sesión). */
  setUser: (user: SessionUser) => void;
  /** Deja la sesión vacía; las guardas de ruta mandan a `/login`. */
  clearSession: () => void;
  /**
   * Cierra la sesión en la API, limpia la sesión local y va a `/login` reemplazando la entrada
   * del historial. Si la API falla (incluido un 401), igual sale: el usuario quiere salir.
   */
  logout: () => Promise<void>;
}

export const SessionContext = createContext<SessionContextValue | null>(null);
