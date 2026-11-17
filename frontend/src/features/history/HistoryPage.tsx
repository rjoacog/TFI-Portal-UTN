import { downloadFile, useGet } from '../../shared/api';
import { LoadingIndicator } from '../../shared/layout/LoadingIndicator';
import { Link } from 'react-router';
import '../../shared/ui/page.css';

interface HistoryItem {
  enrollmentId: number;
  status: 'ACTIVE' | 'DROPPED';
  section: { id: number; name: string; passingGrade: number | null };
  subject: { code: string; name: string };
  term: { year: number; term: number };
  attendance: { label: string };
  grades: {
    activityId: number;
    title: string;
    value: number;
    observation: string | null;
    withoutSubmission: boolean;
    approved: boolean | null;
  }[];
}

export function HistoryPage() {
  const history = useGet<{ history: HistoryItem[] }>('/api/history');
  if (!history.data) return history.error ? <p className="banner banner--error">{history.error}</p> : <LoadingIndicator />;

  return (
    <section className="page">
      <h1 className="page__title">Historial académico</h1>
      <button type="button" className="button button--secondary" onClick={() => void downloadFile('/api/history.csv', 'historial.csv')}>
        Exportar CSV
      </button>
      {history.data.history.length === 0 && <p>Todavía no tenés inscripciones.</p>}
      {history.data.history.map((item) => (
        <article className="card" key={item.enrollmentId}>
          <strong>
            {item.subject.code} · {item.subject.name}
          </strong>
          <span>
            {item.section.name} · {item.term.year} C{item.term.term} · {item.status === 'ACTIVE' ? 'Activa' : 'Baja'}
          </span>
          <span>Asistencia: {item.attendance.label}</span>
          <Link to={`/sections/${item.section.id}`}>Ver el aula</Link>
          <ul>
            {item.grades.map((grade) => (
              <li key={grade.activityId}>
                {grade.title}: {grade.value}
                {grade.withoutSubmission ? ' (sin entrega)' : ''}
                {grade.approved === null ? '' : grade.approved ? ' · aprobada' : ' · no aprobada'}
                {grade.observation ? ` · ${grade.observation}` : ''}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
