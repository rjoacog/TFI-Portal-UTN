import { Link } from 'react-router';
import { useSession } from '../../shared/session';
import { ROLE_LABEL, ROLE_MENU } from '../../shared/layout/menu';
import './HomePage.css';

export function HomePage() {
  const { user } = useSession();
  // `RequireAuth` garantiza el usuario; esto solo ayuda a TypeScript.
  if (!user) return null;

  return (
    <section className="home-page">
      <header className="home-page__header">
        <span className="home-page__role">{ROLE_LABEL[user.role]}</span>
        <h1 className="home-page__title">
          Hola, {user.firstName} {user.lastName}
        </h1>
      </header>
      <nav aria-label="Menú principal">
        <ul className="home-page__menu">
          {ROLE_MENU[user.role].map((item) => (
            <li key={item.to}>
              <Link to={item.to} className="home-page__card">
                <span className="home-page__card-title">{item.label}</span>
                <span className="home-page__card-description">{item.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
