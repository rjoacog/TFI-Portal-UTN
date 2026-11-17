import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import { ApiError, api, downloadFile, useGet } from '../../shared/api';
import { LoadingIndicator } from '../../shared/layout/LoadingIndicator';
import { useSession } from '../../shared/session';
import '../../shared/ui/page.css';

interface Sheet {
  sheet: {
    section: { id: number; name: string; passingGrade: number | null; status: string };
    activities: { id: number; title: string; type: string }[];
    rows: {
      userId: number;
      loginId: string;
      firstName: string;
      lastName: string;
      enrollmentStatus: 'ACTIVE' | 'DROPPED';
      attendance: { label: string };
      cells: { activityId: number; submission: string; grade: number | null; withoutSubmission: boolean; approved: boolean | null }[];
    }[];
  };
}

const DELIVERY: Record<string, string> = {
  NONE: 'Sin entregar',
  ON_TIME: 'A tiempo',
  LATE: 'Tarde',
  GRADED: 'Calificada',
};

export function SheetPage() {
  const { sectionId = '' } = useParams();
  const { user } = useSession();
  const sheet = useGet<Sheet>(`/api/sections/${sectionId}/sheet`);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState('7');
  const [observation, setObservation] = useState('');
  if (!sheet.data) return sheet.error ? <p className="banner banner--error">{sheet.error}</p> : <LoadingIndicator />;
  const data = sheet.data.sheet;

  async function grade(activityId: number, userId: number) {
    setError(null);
    try {
      await api.put(`/api/activities/${activityId}/grade`, {
        userId,
        value: Number(value),
        observation: observation || undefined,
      });
      sheet.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.');
    }
  }

  async function passing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
      await api.patch(`/api/sections/${sectionId}/passing-grade`, { passingGrade: Number(form.get('passingGrade')) });
      sheet.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.');
    }
  }

  return (
    <section className="page">
      <h1 className="page__title">Planilla · {data.section.name}</h1>
      <p className="page__lead">
        Nota de aprobación: {data.section.passingGrade ?? 'sin definir'}
      </p>
      {error && <p className="banner banner--error">{error}</p>}
      <div className="actions">
        <button type="button" className="button button--secondary" onClick={() => void downloadFile(`/api/sections/${sectionId}/sheet.csv`, 'planilla.csv')}>
          Exportar CSV
        </button>
      </div>
      {user?.role === 'TEACHER' && data.section.status === 'OPEN' && (
        <form className="row" onSubmit={passing}>
          <label className="field">
            Nota de aprobación
            <input name="passingGrade" type="number" min={1} max={10} required defaultValue={data.section.passingGrade ?? 6} />
          </label>
          <button className="button" type="submit">
            Definir
          </button>
        </form>
      )}
      {user?.role === 'TEACHER' && (
        <div className="row">
          <label className="field">
            Nota a cargar
            <input value={value} onChange={(event) => setValue(event.target.value)} type="number" min={1} max={10} />
          </label>
          <label className="field">
            Observación
            <input value={observation} onChange={(event) => setObservation(event.target.value)} />
          </label>
        </div>
      )}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Asistencia</th>
              {data.activities.map((activity) => (
                <th key={activity.id}>{activity.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.userId}>
                <td>
                  {row.lastName}, {row.firstName}
                  <div className="muted">{row.loginId} · {row.enrollmentStatus === 'ACTIVE' ? 'activa' : 'baja'}</div>
                </td>
                <td>{row.attendance.label}</td>
                {row.cells.map((cell) => (
                  <td key={cell.activityId}>
                    <div>{DELIVERY[cell.submission]}</div>
                    <div>
                      {cell.grade === null ? 'Sin nota' : cell.grade}
                      {cell.withoutSubmission ? ' sin entrega' : ''}
                      {cell.approved === null ? '' : cell.approved ? ' · aprobada' : ' · no aprobada'}
                    </div>
                    {user?.role === 'TEACHER' && (
                      <button type="button" className="button button--secondary" onClick={() => void grade(cell.activityId, row.userId)}>
                        {cell.grade === null ? 'Calificar' : 'Rectificar'}
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
