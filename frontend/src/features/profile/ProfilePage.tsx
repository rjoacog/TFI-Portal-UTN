import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../shared/api';
import { LoadingIndicator } from '../../shared/layout/LoadingIndicator';
import { ROLE_LABEL } from '../../shared/layout/menu';
import { useSession, type Role } from '../../shared/session';
import './ProfilePage.css';

/** Perfil tal como lo devuelve `GET /api/users/me`. */
interface Profile {
  loginId: string;
  role: Role;
  dni: string;
  firstName: string;
  lastName: string;
  email: string;
}

type FieldErrors = Partial<Record<'firstName' | 'lastName', string>>;

const MAX_LENGTH = 100;

function validateName(value: string, label: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return `Ingresá ${label}`;
  if (trimmed.length > MAX_LENGTH) return `Admite hasta ${MAX_LENGTH} caracteres`;
  return undefined;
}

export function ProfilePage() {
  const { user, setUser } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<{ user: Profile }>('/api/users/me', controller.signal)
      .then(({ user: me }) => {
        setProfile(me);
        setFirstName(me.firstName);
        setLastName(me.lastName);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.');
      });
    return () => controller.abort();
  }, []);

  function startEditing() {
    setSaved(false);
    setEditing(true);
  }

  /** Vuelve a modo lectura, descartando lo escrito y los errores. */
  function stopEditing() {
    if (profile) {
      setFirstName(profile.firstName);
      setLastName(profile.lastName);
    }
    setFieldErrors({});
    setApiError(null);
    setEditing(false);
  }

  // El foco acompaña el cambio de modo: al primer campo al editar, al botón al volver.
  const wasEditing = useRef(false);
  useEffect(() => {
    if (editing) firstNameRef.current?.focus();
    else if (wasEditing.current) editButtonRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !user) return;

    // Validación del navegador; los errores de la API se muestran siempre, además.
    const errors: FieldErrors = {};
    const firstNameError = validateName(firstName, 'tu nombre');
    const lastNameError = validateName(lastName, 'tu apellido');
    if (firstNameError) errors.firstName = firstNameError;
    if (lastNameError) errors.lastName = lastNameError;
    setFieldErrors(errors);
    setApiError(null);
    setSaved(false);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await api.patch<{ user: Profile }>('/api/users/me', { firstName, lastName });
      setProfile(res.user);
      setFirstName(res.user.firstName);
      setLastName(res.user.lastName);
      // El saludo del inicio sale de la sesión: se actualiza sin recargar.
      setUser({ ...user, firstName: res.user.firstName, lastName: res.user.lastName });
      setSaved(true);
      setEditing(false);
    } catch (err) {
      if (err instanceof ApiError) {
        const next: FieldErrors = {};
        for (const detail of err.details ?? []) {
          if (detail.path === 'firstName' || detail.path === 'lastName') {
            next[detail.path] = detail.message;
          }
        }
        setFieldErrors(next);
        if (Object.keys(next).length === 0) setApiError(err.message);
      } else {
        setApiError('Ocurrió un error inesperado.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <section className="profile">
        <h1 className="profile__title">Mi perfil</h1>
        <p className="profile__error" role="alert">
          {loadError}
        </p>
      </section>
    );
  }

  if (!profile) return <LoadingIndicator />;

  return (
    <section className="profile">
      <h1 className="profile__title">Mi perfil</h1>
      <dl className="profile__data">
        <div>
          <dt>Nombre</dt>
          <dd>{profile.firstName}</dd>
        </div>
        <div>
          <dt>Apellido</dt>
          <dd>{profile.lastName}</dd>
        </div>
        <div>
          <dt>Legajo</dt>
          <dd>{profile.loginId}</dd>
        </div>
        <div>
          <dt>Rol</dt>
          <dd>{ROLE_LABEL[profile.role]}</dd>
        </div>
        <div>
          <dt>DNI</dt>
          <dd>{profile.dni}</dd>
        </div>
        <div>
          <dt>Correo</dt>
          <dd>{profile.email}</dd>
        </div>
      </dl>
      {saved && (
        <p className="profile__success" role="status">
          Tus datos se guardaron
        </p>
      )}
      {editing ? (
        <form className="profile__form" onSubmit={handleSubmit} noValidate>
          {apiError && (
            <p className="profile__error" role="alert">
              {apiError}
            </p>
          )}
          <label className="profile__field">
            Nombre
            <input
              type="text"
              name="firstName"
              autoComplete="given-name"
              required
              ref={firstNameRef}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            {fieldErrors.firstName && (
              <span className="profile__field-error">{fieldErrors.firstName}</span>
            )}
          </label>
          <label className="profile__field">
            Apellido
            <input
              type="text"
              name="lastName"
              autoComplete="family-name"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
            {fieldErrors.lastName && (
              <span className="profile__field-error">{fieldErrors.lastName}</span>
            )}
          </label>
          <div className="profile__actions">
            <button type="submit" className="button" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              className="button button--secondary"
              disabled={submitting}
              onClick={stopEditing}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="profile__actions">
          <button type="button" className="button" ref={editButtonRef} onClick={startEditing}>
            Editar mis datos
          </button>
        </div>
      )}
    </section>
  );
}
