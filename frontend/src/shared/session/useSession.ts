import { useContext } from 'react';
import { SessionContext, type SessionContextValue } from './session-context';

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession se debe usar dentro de <SessionProvider>');
  return ctx;
}
