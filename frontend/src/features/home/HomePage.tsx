import { useEffect, useState } from 'react';
import { api } from '../../shared/api';
import './HomePage.css';

type HealthState = 'loading' | 'ok' | 'error';

// Pantalla provisoria: queda hasta que exista el inicio real.
export function HomePage() {
  const [state, setState] = useState<HealthState>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<{ status: string }>('/api/health', controller.signal)
      .then(() => setState('ok'))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setMessage(err instanceof Error ? err.message : 'Error desconocido');
        setState('error');
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="home-page">
      <h1 className="home-page__title">UTN Connect</h1>
      {state === 'loading' && <p className="home-page__status">Consultando la API…</p>}
      {state === 'ok' && (
        <p className="home-page__status home-page__status--ok">La API responde correctamente.</p>
      )}
      {state === 'error' && (
        <p className="home-page__status home-page__status--error" role="alert">
          La API no responde. {message}
        </p>
      )}
    </section>
  );
}
