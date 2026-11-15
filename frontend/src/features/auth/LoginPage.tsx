import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { api, ApiError } from '../../shared/api';
import { useSession, type SessionUser } from '../../shared/session';
import './LoginPage.css';

export function LoginPage() {
  const { user, setUser } = useSession();
  const location = useLocation();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Con sesión (recién iniciada o ya existente): al cambio de contraseña, a la ruta pedida o a `/`.
  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={user.mustChangePassword ? '/change-password' : (from ?? '/')} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ user: SessionUser }>('/api/auth/login', { loginId, password });
      setUser(res.user);
    } catch (err) {
      // Se muestra el mensaje de la API (o el del cliente en errores de red). El legajo se conserva.
      setError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.');
      setPassword('');
      setSubmitting(false);
    }
  }

  return (
    <div className="login">
      <div className="login__brand">
        <div className="login__logo">UTN Connect</div>
        <div className="login__pitch">
          <h2 className="login__pitch-title">Tu cursada en un solo lugar</h2>
          <p className="login__pitch-text">
            Material, anuncios, trabajos prácticos, notas y asistencia de tus comisiones.
          </p>
        </div>
        <div className="login__campus">Tecnicaturas · Sede Concepción</div>
      </div>
      <div className="login__panel">
        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <h1 className="login__title">Iniciar sesión</h1>
          {error && (
            <p className="login__error" role="alert">
              {error}
            </p>
          )}
          <label className="login__field">
            Legajo
            <input
              type="text"
              name="loginId"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
            />
          </label>
          <label className="login__field">
            Contraseña
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" className="button" disabled={submitting}>
            {submitting ? 'Ingresando…' : 'Ingresar'}
          </button>
          <p className="login__help">
            ¿No podés entrar? Pedile a la administración que restablezca tu contraseña.
          </p>
        </form>
      </div>
    </div>
  );
}
