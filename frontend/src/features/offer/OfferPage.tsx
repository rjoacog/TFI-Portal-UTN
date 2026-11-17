import { useState } from 'react';
import { Link } from 'react-router';
import { ApiError, api, useGet } from '../../shared/api';
import { LoadingIndicator } from '../../shared/layout/LoadingIndicator';
import '../../shared/ui/page.css';

interface OfferSection {
  id: number;
  name: string;
  subject: { code: string; name: string };
  term: { year: number; term: number };
  enrollment: { id: number; status: 'ACTIVE' | 'DROPPED' } | null;
}

export function OfferPage() {
  const offer = useGet<{ sections: OfferSection[] }>('/api/offer');
  const [error, setError] = useState<string | null>(null);
  if (!offer.data) return offer.error ? <p className="banner banner--error">{offer.error}</p> : <LoadingIndicator />;

  async function enroll(sectionId: number) {
    setError(null);
    try {
      await api.post(`/api/sections/${sectionId}/enrollments`);
      offer.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.');
    }
  }

  async function drop(enrollmentId: number) {
    if (!window.confirm('Si te das de baja no vas a poder entregar ni volver por tu cuenta.')) return;
    setError(null);
    try {
      await api.post(`/api/enrollments/${enrollmentId}/drop`);
      offer.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.');
    }
  }

  return (
    <section className="page">
      <h1 className="page__title">Oferta</h1>
      <p className="page__lead">Comisiones abiertas del período vigente, de tus carreras.</p>
      {error && <p className="banner banner--error">{error}</p>}
      {offer.data.sections.length === 0 && <p>No hay comisiones abiertas para tus carreras.</p>}
      {offer.data.sections.map((section) => (
        <article className="card" key={section.id}>
          <strong>
            {section.subject.code} · {section.subject.name}
          </strong>
          <span>
            {section.name} · {section.term.year} C{section.term.term}
          </span>
          <span className="muted">
            {section.enrollment === null
              ? 'Sin inscripción'
              : section.enrollment.status === 'ACTIVE'
                ? 'Inscripción activa'
                : 'De baja'}
          </span>
          <div className="actions">
            {section.enrollment === null && (
              <button type="button" className="button" onClick={() => void enroll(section.id)}>
                Inscribirme
              </button>
            )}
            {section.enrollment?.status === 'ACTIVE' && (
              <>
                <Link to={`/sections/${section.id}`}>Entrar al aula</Link>
                <button type="button" className="button button--secondary" onClick={() => void drop(section.enrollment!.id)}>
                  Darme de baja
                </button>
              </>
            )}
            {section.enrollment?.status === 'DROPPED' && <Link to={`/sections/${section.id}`}>Ver el aula</Link>}
          </div>
        </article>
      ))}
    </section>
  );
}
