import { Navigate, Outlet } from 'react-router';
import type { Role } from '../shared/session';
import { useSession } from '../shared/session';

/** Deja pasar solo a los roles indicados. El resto vuelve al inicio. */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { user } = useSession();
  if (!user) return null;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
