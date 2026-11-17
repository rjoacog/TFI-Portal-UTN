import { useState, type FormEvent } from 'react';
import { ApiError, api, useGet } from '../../shared/api';
import { LoadingIndicator } from '../../shared/layout/LoadingIndicator';
import { ROLE_LABEL } from '../../shared/layout/menu';
import type { Role } from '../../shared/session';
import '../../shared/ui/page.css';

interface Program {
  id: number;
  name: string;
}

interface AdminUser {
  id: number;
  loginId: string;
  role: Role;
  dni: string;
  firstName: string;
  lastName: string;
  email: string;
  status: 'ACTIVE' | 'DISABLED';
  programs: Program[];
}

export function UsersPage() {
  const users = useGet<{ users: AdminUser[] }>('/api/users');
  const programs = useGet<{ programs: Program[] }>('/api/programs');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const [editingPrograms, setEditingPrograms] = useState<AdminUser | null>(null);
  const [selectedPrograms, setSelectedPrograms] = useState<number[]>([]);

  async function run(action: () => Promise<void>) {
    setError(null);
    setMessage(null);
    try {
      await action();
      users.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.');
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const role = String(form.get('role'));
    const programIds = form.getAll('programIds').map(Number);
    await run(async () => {
      const result = await api.post<{ temporaryPassword: string }>('/api/users', {
        role,
        legajoNumber: String(form.get('legajoNumber')),
        dni: String(form.get('dni')),
        firstName: String(form.get('firstName')),
        lastName: String(form.get('lastName')),
        email: String(form.get('email')),
        programIds: role === 'STUDENT' ? programIds : [],
      });
      setPassword(result.temporaryPassword);
      setMessage('Usuario creado. La contraseña temporal se muestra una sola vez.');
      formElement.reset();
    });
  }

  if (!users.data || !programs.data) {
    return users.error ? <p className="banner banner--error">{users.error}</p> : <LoadingIndicator />;
  }
  const catalog = programs.data.programs;

  return (
    <section className="page">
      <h1 className="page__title">Usuarios</h1>
      {error && <p className="banner banner--error">{error}</p>}
      {message && <p className="banner banner--success">{message}</p>}
      {password && (
        <p className="banner banner--success">
          Contraseña temporal: <strong>{password}</strong>
        </p>
      )}
      <form className="card stack" onSubmit={create}>
        <h2>Dar de alta</h2>
        <div className="row">
          <label className="field">
            Rol
            <select name="role" defaultValue="STUDENT">
              <option value="STUDENT">Alumno</option>
              <option value="TEACHER">Docente</option>
              <option value="ADMIN">Administrador</option>
              <option value="DIRECTOR">Directivo</option>
            </select>
          </label>
          <label className="field">
            Número de legajo
            <input name="legajoNumber" required pattern="\d+" />
          </label>
          <label className="field">
            DNI
            <input name="dni" required pattern="\d{7,8}" />
          </label>
          <label className="field">
            Nombre
            <input name="firstName" required />
          </label>
          <label className="field">
            Apellido
            <input name="lastName" required />
          </label>
          <label className="field">
            Correo
            <input name="email" type="email" required />
          </label>
        </div>
        <fieldset className="stack">
          <legend>Carreras del alumno</legend>
          {catalog.map((program) => (
            <label key={program.id}>
              <input type="checkbox" name="programIds" value={program.id} /> {program.name}
            </label>
          ))}
        </fieldset>
        <button className="button" type="submit">
          Crear usuario
        </button>
      </form>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Legajo</th>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Carreras</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.data.users.map((user) => (
              <tr key={user.id}>
                <td>{user.loginId}</td>
                <td>
                  {user.lastName}, {user.firstName}
                </td>
                <td>{ROLE_LABEL[user.role]}</td>
                <td>{user.status === 'ACTIVE' ? 'Activo' : 'Desactivado'}</td>
                <td>{user.programs.map((program) => program.name).join(', ')}</td>
                <td className="actions">
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() =>
                      void run(async () => {
                        await api.patch(`/api/users/${user.id}/status`, {
                          status: user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                        });
                      })
                    }
                  >
                    {user.status === 'ACTIVE' ? 'Desactivar' : 'Reactivar'}
                  </button>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() =>
                      void run(async () => {
                        const result = await api.post<{ temporaryPassword: string }>(
                          `/api/users/${user.id}/password-reset`,
                        );
                        setPassword(result.temporaryPassword);
                        setMessage('Contraseña restablecida. Se muestra una sola vez.');
                      })
                    }
                  >
                    Restablecer
                  </button>
                  {user.role === 'STUDENT' && (
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => {
                        setEditingPrograms(user);
                        setSelectedPrograms(user.programs.map((program) => program.id));
                        setError(null);
                        setMessage(null);
                      }}
                    >
                      Carreras
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editingPrograms && (
        <form
          className="card stack"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await api.put(`/api/users/${editingPrograms.id}/programs`, { programIds: selectedPrograms });
              setMessage('Carreras actualizadas. Las inscripciones existentes no cambian.');
              setEditingPrograms(null);
            });
          }}
        >
          <h2>
            Carreras de {editingPrograms.lastName}, {editingPrograms.firstName}
          </h2>
          <p className="muted">Tiene que quedar al menos una. Quitar una carrera no da de baja las inscripciones.</p>
          {catalog.map((program) => (
            <label key={program.id}>
              <input
                type="checkbox"
                checked={selectedPrograms.includes(program.id)}
                onChange={(event) => {
                  setSelectedPrograms((current) =>
                    event.target.checked
                      ? [...current, program.id]
                      : current.filter((id) => id !== program.id),
                  );
                }}
              />{' '}
              {program.name}
            </label>
          ))}
          <div className="actions">
            <button className="button" type="submit" disabled={selectedPrograms.length === 0}>
              Guardar carreras
            </button>
            <button type="button" className="button button--secondary" onClick={() => setEditingPrograms(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
