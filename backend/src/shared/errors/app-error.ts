/** Detalle de un campo inválido, dentro de `details`. */
export interface ErrorDetail {
  path: string;
  message: string;
}

/** Cuerpo de toda respuesta de error de la API (formato común de errores). */
export interface ErrorResponseBody {
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[];
  };
}

/**
 * Error esperado que lanzan los servicios y las rutas.
 * El middleware de errores lo traduce al formato común con su código HTTP.
 *
 * - `code`: identificador estable, en inglés y en mayúsculas (por ejemplo, `NOT_FOUND`).
 * - `message`: texto en español para el usuario.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function toErrorBody(code: string, message: string, details?: ErrorDetail[]) {
  const body: ErrorResponseBody = { error: { code, message } };
  if (details !== undefined) body.error.details = details;
  return body;
}
