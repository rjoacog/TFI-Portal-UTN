import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from '../validation/index.js';
import { AppError, errorHandler } from './index.js';

/** App mínima con rutas que lanzan cada tipo de error. */
function buildApp() {
  const app = express();
  app.use(express.json());

  app.get('/app-error', () => {
    throw new AppError(409, 'CONFLICT', 'Ya existe una inscripción activa');
  });
  // Express 5 propaga solo los errores de los handlers async.
  app.get('/app-error-async', async () => {
    throw new AppError(404, 'NOT_FOUND', 'La comisión no existe');
  });
  app.post('/zod-error', (req) => {
    z.object({ loginId: z.string(), age: z.number().int() }).parse(req.body);
  });
  app.get('/unexpected', () => {
    throw new Error('detalle interno: conexión a 10.0.0.5 rechazada');
  });

  app.use(errorHandler);
  return app;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('errorHandler', () => {
  it('un AppError responde con su código HTTP y el formato común', async () => {
    const res = await request(buildApp()).get('/app-error');

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'CONFLICT', message: 'Ya existe una inscripción activa' },
    });
  });

  it('un AppError lanzado en un handler async también llega al middleware', async () => {
    const res = await request(buildApp()).get('/app-error-async');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('un ZodError responde 400 VALIDATION_ERROR con details por campo, en español', async () => {
    const res = await request(buildApp()).post('/zod-error').send({ age: 'diez' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBe('Los datos enviados no son válidos');
    expect(res.body.error.details).toEqual([
      { path: 'loginId', message: expect.stringContaining('se esperaba texto') },
      { path: 'age', message: expect.stringContaining('se esperaba número') },
    ]);
  });

  it('un error inesperado responde 500 INTERNAL_ERROR sin exponer el mensaje interno', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(buildApp()).get('/unexpected');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado' },
    });
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
    expect(consoleError).toHaveBeenCalledOnce();
  });
});
