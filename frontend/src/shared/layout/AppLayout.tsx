import { Link, Outlet } from 'react-router';
import './AppLayout.css';

export function AppLayout() {
  return (
    <div className="app-layout">
      <header className="app-layout__header">
        <Link to="/" className="app-layout__brand">
          UTN <span className="app-layout__brand-accent">Connect</span>
        </Link>
      </header>
      <main className="app-layout__content">
        <Outlet />
      </main>
    </div>
  );
}
