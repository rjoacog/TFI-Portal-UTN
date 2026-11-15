import { Navigate, Outlet, useLocation } from 'react-router';
import { LoadingIndicator } from '../shared/layout/LoadingIndicator';
import { useSession } from '../shared/session';

/** Guarda de ruta: exige sesión y, si hay cambio de contraseña pendiente, solo deja `/change-password`. */
export function RequireAuth() {
  const { user, status } = useSession();
  const location = useLocation();

  if (status === 'loading') return <LoadingIndicator />;

  if (!user) {
    // Se recuerda la ruta pedida para volver después de iniciar sesión.
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from }} />;
  }

  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}
