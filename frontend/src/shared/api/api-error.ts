export interface ApiErrorDetail {
  path?: string;
  message: string;
}

/** Códigos propios del cliente, para respuestas que no vienen en el formato común de la API. */
export const CLIENT_ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
} as const;

/** Error de una llamada a la API. Las pantallas deciden según `code`, no según `message`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorDetail[];

  constructor(status: number, code: string, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
