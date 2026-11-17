import { Link } from 'react-router';
import { useGet } from '../../shared/api';
import { LoadingIndicator } from '../../shared/layout/LoadingIndicator';
import '../../shared/ui/page.css';

interface Section {
  id: number;
  name: string;
  status: 'OPEN' | 'CLOSED';
  subject: { code: string; name: string };
  term: { year: number; term: number };
}

export function TeachingPage() {
  const list = useGet<{ sections: Section[] }>('/api/teaching/sections');
  if (!list.data) return list.error ? <p className="banner banner--error">{list.error}</p> : <LoadingIndicator />;

  return (
    <section className="page">
      <h1 className="page__title">Mis comisiones</h1>
      {list.data.sections.map((section) => (
        <article className="card" key={section.id}>
          <strong>
            {section.subject.code} · {section.name}
          </strong>
          <span className="muted">
            {section.term.year} C{section.term.term} · {section.status === 'OPEN' ? 'Abierta' : 'Cerrada'}
          </span>
          <div className="actions">
            <Link to={`/sections/${section.id}`}>Aula</Link>
            <Link to={`/sections/${section.id}/sheet`}>Planilla</Link>
            <Link to={`/sections/${section.id}/attendance`}>Asistencia</Link>
            <Link to={`/sections/${section.id}/enrollments`}>Inscripciones</Link>
          </div>
        </article>
      ))}
    </section>
  );
}
