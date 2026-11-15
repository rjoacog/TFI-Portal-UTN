import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { api, ApiError } from '../../shared/api';
import { useSession, type SessionUser } from '../../shared/session';
import './ChangePasswordPage.css';

const MIN_LENGTH = 8;

type FieldErrors = Partial<Record<'newPassword' | 'newPasswordConfirmation', string>>;

export function ChangePasswordPage() {
  const { user, setUser, logout } = useSession();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const mandatory = user?.mustChangePassword ?? false;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    // Validación del navegador; el error de la API se muestra siempre, además.
    const errors: FieldErrors = {};
    if (newPassword.length < MIN_LENGTH) {
      errors.newPassword = `La nueva contraseña tiene que tener al menos ${MIN_LENGTH} caracteres`;
    }
    if (newPassword !== newPasswordConfirmation) {
      errors.newPasswordConfirmation = 'Las contraseñas no coinciden';
    }
    setFieldErrors(errors);
    setApiError(null);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await api.post<{ user: SessionUser }>('/api/auth/password', {
        currentPassword,
        newPassword,
        newPasswordConfirmation,
      });
      setUser(res.user);
      if (mandatory) {
        navigate('/', { replace: true });
      } else {
        setDone(true);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err.message);
        const detail = err.details?.find((d) => d.path === 'newPasswordConfirmation');
        if (detail) setFieldErrors({ newPasswordConfirmation: detail.message });
      } else {
        setApiError('Ocurrió un error inesperado.');
      }
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section className="change-password">
        <h1 className="change-password__title">Cambiar contraseña</h1>
        <p className="change-password__success" role="status">
          Tu contraseña se cambió
        </p>
        <div className="change-password__actions">
          <button type="button" className="button" onClick={() => navigate('/', { replace: true })}>
            Volver al inicio
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="change-password">
      <h1 className="change-password__title">Cambiar contraseña</h1>
      {mandatory && (
        <p className="change-password__notice">
          Antes de continuar, tenés que cambiar la contraseña temporal
        </p>
      )}
      <form className="change-password__form" onSubmit={handleSubmit} noValidate>
        {apiError && (
          <p className="change-password__error" role="alert">
            {apiError}
          </p>
        )}
        <label className="change-password__field">
          Contraseña actual
          <input
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </label>
        <label className="change-password__field">
          Nueva contraseña
          <input
            type="password"
            name="newPassword"
            autoComplete="new-password"
            aria-describedby="new-password-hint"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <span id="new-password-hint" className="change-password__hint">
            Al menos 8 caracteres y distinta de la actual
          </span>
          {fieldErrors.newPassword && (
            <span className="change-password__field-error">{fieldErrors.newPassword}</span>
          )}
        </label>
        <label className="change-password__field">
          Repetir la nueva contraseña
          <input
            type="password"
            name="newPasswordConfirmation"
            autoComplete="new-password"
            required
            value={newPasswordConfirmation}
            onChange={(e) => setNewPasswordConfirmation(e.target.value)}
          />
          {fieldErrors.newPasswordConfirmation && (
            <span className="change-password__field-error">
              {fieldErrors.newPasswordConfirmation}
            </span>
          )}
        </label>
        <div className="change-password__actions">
          <button type="submit" className="button" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
          {mandatory && (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => void logout()}
            >
              Cerrar sesión
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
