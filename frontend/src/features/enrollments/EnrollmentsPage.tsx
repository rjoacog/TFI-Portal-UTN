import { useState } from 'react';
import { useParams } from 'react-router';
import { ApiError, api, useGet } from '../../shared/api';
import { LoadingIndicator } from '../../shared/layout/LoadingIndicator';
import { useSession } from '../../shared/session';
import '../../shared/ui/page.css';

interface Enrollment {
  id: number;
  status: 'ACTIVE' | 'DROPPED';
  user: { loginId: string; firstName: string; lastName: string };
}

export function EnrollmentsPage() {
  const { sectionId = '' } = useParams();
  const { user } = useSession();
  const list = useGet<{ enrollments: Enrollment[] }>(`/api/sections/${sectionId}/enrollments`);
  const [error, setError] = useState<string | null>(null);
  if (!list.data) return list.error ? <p className="banner banner--error">{list.error}</p> : <LoadingIndicator />;

  async function act(path: string) {
    setError(null);
    try {
      await api.post(path);
      list.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.');
    }
  }

  return (
    <section className="page">
      <h1 className="page__title">Inscripciones</h1>
      {error && <p className="banner banner--error">{error}</p>}
      <table className="table">
        <tbody>
          {list.data.enrollments.map((enrollment) => (
            <tr key={enrollment.id}>
              <td>
                {enrollment.user.lastName}, {enrollment.user.firstName}
                <div className="muted">{enrollment.user.loginId}</div>
              </td>
              <td>{enrollment.status === 'ACTIVE' ? 'Activa' : 'Baja'}</td>
              <td>
                {user?.role === 'ADMIN' && enrollment.status === 'ACTIVE' && (
                  <button type="button" className="button button--secondary" onClick={() => void act(`/api/enrollments/${enrollment.id}/drop`)}>
                    Dar de baja
                  </button>
                )}
                {user?.role === 'ADMIN' && enrollment.status === 'DROPPED' && (
                  <button type="button" className="button" onClick={() => void act(`/api/enrollments/${enrollment.id}/reactivate`)}>
                    Reactivar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
