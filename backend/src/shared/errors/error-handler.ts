import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, toErrorBody } from './app-error.js';

/** Rutas inexistentes: 404 con el formato común, en lugar del HTML por defecto de Express. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', 'El recurso solicitado no existe'));
};

/** Errores de `express.json()` (body-parser), que traen `type` y `status`. */
function isBodyParserError(err: unknown): err is { type: string; status: number } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    typeof err.type === 'string' &&
    'status' in err &&
    typeof err.status === 'number'
  );
}

/** Middleware de errores. Se registra al final de `app.ts`. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  // Si la respuesta ya empezó a enviarse, solo Express puede cortar la conexión.
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json(toErrorBody(err.code, err.message, err.details));
    return;
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      message: issue.message,
    }));
    res
      .status(400)
      .json(toErrorBody('VALIDATION_ERROR', 'Los datos enviados no son válidos', details));
    return;
  }

  if (isBodyParserError(err) && err.type === 'entity.parse.failed') {
    res.status(400).json(toErrorBody('INVALID_JSON', 'El cuerpo del pedido no es un JSON válido'));
    return;
  }

  if (isBodyParserError(err) && err.type === 'entity.too.large') {
    res
      .status(413)
      .json(toErrorBody('PAYLOAD_TOO_LARGE', 'El cuerpo del pedido supera el tamaño permitido'));
    return;
  }

  // Error inesperado: se registra completo, pero al cliente no se le expone nada interno.
  console.error(err);
  res.status(500).json(toErrorBody('INTERNAL_ERROR', 'Ocurrió un error inesperado'));
};
