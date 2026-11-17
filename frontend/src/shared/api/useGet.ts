import { useEffect, useState } from 'react';
import { ApiError } from './api-error';
import { api } from './client';

/** Carga un GET y permite volver a pedirlo después de un cambio. */
export function useGet<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api
      .get<T>(path, controller.signal)
      .then((next) => {
        setData(next);
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado.');
      });
    return () => controller.abort();
  }, [path, version]);

  return { data, error, reload: () => setVersion((value) => value + 1) };
}
