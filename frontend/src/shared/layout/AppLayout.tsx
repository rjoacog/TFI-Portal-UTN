import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useSession } from '../session';
import { ROLE_LABEL, ROLE_MENU } from './menu';
import './AppLayout.css';

/** Iniciales para el avatar: primera letra del nombre y del apellido. */
function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'app-shell__nav app-shell__nav--on' : 'app-shell__nav';

export function AppLayout() {
  const { user } = useSession();
  const { pathname } = useLocation();

  // Sin sesión (o en el inicio de sesión) la pantalla ocupa todo el ancho, sin menú ni cabecera.
  if (!user || pathname === '/login') {
    return (
      <div className="app-bare">
        <Outlet />
      </div>
    );
  }

  const fullName = `${user.firstName} ${user.lastName}`;

  // Con el cambio de contraseña pendiente solo hay cabecera: no hay menú.
  if (user.mustChangePassword) {
    return (
      <div className="app-simple">
        <header className="app-simple__header">
          <span className="app-simple__brand">
            UTN <span className="app-simple__brand-accent">Connect</span>
          </span>
          <span className="app-simple__user">
            {fullName} · Legajo {user.loginId}
          </span>
        </header>
        <main className="app-simple__content">
          <Outlet />
        </main>
      </div>
    );
  }

  const items = ROLE_MENU[user.role];

  return (
    <div className="app-shell">
      <nav className="app-shell__side" aria-label="Menú lateral">
        <Link to="/" className="app-shell__brand">
          UTN <span className="app-shell__brand-accent">Connect</span>
        </Link>
        <NavLink to="/" end className={navClass}>
          Inicio
        </NavLink>
        <div className="app-shell__foot">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className={navClass}>
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <div className="app-shell__main">
        <div className="app-shell__top">
          <span className="app-shell__crumb">{ROLE_LABEL[user.role]}</span>
          <div className="app-shell__user">
            <span>
              {fullName} · Legajo {user.loginId}
            </span>
            <span className="app-shell__avatar" aria-hidden="true">
              {initials(user.firstName, user.lastName)}
            </span>
          </div>
        </div>
        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
