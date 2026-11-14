import { ApiError, CLIENT_ERROR_CODES, type ApiErrorDetail } from './api-error';

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * Registra qué hacer ante un 401. El cliente no es un componente de React, así que no puede
 * usar hooks: el proveedor de sesión registra acá una función que limpia la sesión y redirige.
 * Devuelve una función para desregistrarla.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (text === '') return undefined;
  return JSON.parse(text);
}

function toApiError(status: number, payload: unknown): ApiError {
  const error = (payload as { error?: Record<string, unknown> } | null | undefined)?.error;
  if (error && typeof error.code === 'string' && typeof error.message === 'string') {
    const details = Array.isArray(error.details) ? (error.details as ApiErrorDetail[]) : undefined;
    return new ApiError(status, error.code, error.message, details);
  }
  // La respuesta no tiene el formato común (por ejemplo, la API está apagada y el proxy responde 502).
  return new ApiError(
    status,
    CLIENT_ERROR_CODES.INVALID_RESPONSE,
    'No se pudo comunicar con el servidor. Probá de nuevo en unos minutos.',
  );
}

/** Único lugar desde donde la web llama a la API. `path` es relativo: `/api/...`. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'include',
      signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError(
      0,
      CLIENT_ERROR_CODES.NETWORK_ERROR,
      'No hay conexión con el servidor. Revisá tu conexión a internet.',
    );
  }

  let payload: unknown;
  try {
    payload = await parseJson(res);
  } catch {
    if (res.ok) {
      throw new ApiError(
        res.status,
        CLIENT_ERROR_CODES.INVALID_RESPONSE,
        'El servidor respondió algo inesperado.',
      );
    }
    payload = undefined;
  }

  if (!res.ok) {
    if (res.status === 401) unauthorizedHandler?.();
    throw toApiError(res.status, payload);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => apiRequest<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};
