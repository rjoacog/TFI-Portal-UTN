import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import { ApiError, api, useGet } from '../../shared/api';
import { LoadingIndicator } from '../../shared/layout/LoadingIndicator';
import { useSession } from '../../shared/session';
import '../../shared/ui/page.css';

interface ClassSession {
  id: number;
  date: string;
  records: { userId: number; value: 'PRESENT' | 'ABSENT'; user: { firstName: string; lastName: string; loginId: string } }[];
}

export function AttendancePage() {
  const { sectionId = '' } = useParams();
  const { user } = useSession();
  const classes = useGet<{ classes: ClassSession[] }>(`/api/sections/${sectionId}/classes`);
  const [error, setError] = useState<string | null>(null);
  if (!classes.data) return classes.error ? <p className="banner banner--error">{classes.error}</p> : <LoadingIndicator />;

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
      await api.post(`/api/sections/${sectionId}/classes`, { date: form.get('date') });
      classes.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.');
    }
  }

  async function correct(classSession: ClassSession, userId: number, value: 'PRESENT' | 'ABSENT') {
    setError(null);
    try {
      await api.patch(`/api/classes/${classSession.id}`, { records: [{ userId, value }] });
      classes.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.');
    }
  }

  return (
    <section className="page">
      <h1 className="page__title">Asistencia</h1>
      {error && <p className="banner banner--error">{error}</p>}
      {user?.role === 'TEACHER' && (
        <form className="row" onSubmit={create}>
          <label className="field">
            Fecha de la clase
            <input name="date" type="date" required />
          </label>
          <button className="button" type="submit">
            Registrar clase
          </button>
        </form>
      )}
      {classes.data.classes.map((classSession) => (
        <article className="card" key={classSession.id}>
          <strong>{classSession.date.slice(0, 10)}</strong>
          {classSession.records.length === 0 && (
            <p className="muted">Ese día no había alumnos activos en la comisión.</p>
          )}
          <table className="table">
            <tbody>
              {classSession.records.map((record) => (
                <tr key={record.userId}>
                  <td>
                    {record.user.lastName}, {record.user.firstName}
                  </td>
                  <td>{record.value === 'PRESENT' ? 'Presente' : 'Ausente'}</td>
                  {user?.role === 'TEACHER' && (
                    <td>
                      <button
                        type="button"
                        className="button button--secondary"
                        onClick={() => void correct(classSession, record.userId, record.value === 'PRESENT' ? 'ABSENT' : 'PRESENT')}
                      >
                        Corregir
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ))}
    </section>
  );
}
