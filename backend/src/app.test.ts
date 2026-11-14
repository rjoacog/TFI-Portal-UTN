import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

const ALLOWED_ORIGIN = 'http://localhost:5173';

function buildApp(rateLimit?: { windowMs: number; limit: number }) {
  return createApp({ corsOrigins: [ALLOWED_ORIGIN], rateLimit });
}

describe('GET /api/health', () => {
  it('responde 200 con { status: "ok" }', async () => {
    const res = await request(buildApp()).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('aplica las cabeceras de seguridad de helmet', async () => {
    const res = await request(buildApp()).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('rutas inexistentes', () => {
  it('responden 404 NOT_FOUND con el formato común', async () => {
    const res = await request(buildApp()).get('/api/no-existe');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'El recurso solicitado no existe' },
    });
  });
});

describe('cuerpo JSON inválido', () => {
  it('responde 400 INVALID_JSON con el formato común', async () => {
    const res = await request(buildApp())
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{ "a": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('CORS', () => {
  it('un origen permitido recibe Access-Control-Allow-Origin y credenciales', async () => {
    const res = await request(buildApp()).get('/api/health').set('Origin', ALLOWED_ORIGIN);

    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('un origen que no está en CORS_ORIGINS no recibe Access-Control-Allow-Origin', async () => {
    const res = await request(buildApp()).get('/api/health').set('Origin', 'https://otro.com');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('límite global de pedidos', () => {
  it('al superarlo responde 429 TOO_MANY_REQUESTS con el formato común', async () => {
    const app = buildApp({ windowMs: 60_000, limit: 2 });

    await request(app).get('/api/health').expect(200);
    await request(app).get('/api/health').expect(200);
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(typeof res.body.error.message).toBe('string');
  });
});
