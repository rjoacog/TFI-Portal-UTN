import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from './env.js';

const VALID = {
  NODE_ENV: 'development',
  PORT: '3000',
  DATABASE_URL: 'postgresql://usuario:clave@localhost:5432/utn_connect',
  CORS_ORIGINS: 'http://localhost:5173',
};

/** Devuelve el mensaje de error de `parseEnv`, o falla si no lanzó. */
function envError(source: Record<string, string | undefined>) {
  try {
    parseEnv(source);
  } catch (err) {
    expect(err).toBeInstanceOf(EnvValidationError);
    return (err as EnvValidationError).message;
  }
  throw new Error('parseEnv no lanzó EnvValidationError');
}

describe('parseEnv', () => {
  it('acepta un entorno válido y convierte los tipos', () => {
    expect(parseEnv(VALID)).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: VALID.DATABASE_URL,
      CORS_ORIGINS: ['http://localhost:5173'],
    });
  });

  it('informa todas las variables que fallan a la vez', () => {
    const message = envError({});

    expect(message).toContain('NODE_ENV');
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('CORS_ORIGINS');
  });

  describe('NODE_ENV', () => {
    it('es obligatoria', () => {
      expect(envError({ ...VALID, NODE_ENV: undefined })).toContain('NODE_ENV');
    });

    it('solo acepta development, test o production', () => {
      expect(envError({ ...VALID, NODE_ENV: 'staging' })).toContain('NODE_ENV');
      for (const value of ['development', 'test', 'production']) {
        expect(parseEnv({ ...VALID, NODE_ENV: value }).NODE_ENV).toBe(value);
      }
    });
  });

  describe('PORT', () => {
    it('usa 3000 si no está definida', () => {
      expect(parseEnv({ ...VALID, PORT: undefined }).PORT).toBe(3000);
    });

    it.each(['abc', '0', '70000', '30.5'])('rechaza %s', (value) => {
      expect(envError({ ...VALID, PORT: value })).toContain('PORT');
    });
  });

  describe('DATABASE_URL', () => {
    it('es obligatoria', () => {
      expect(envError({ ...VALID, DATABASE_URL: undefined })).toContain(
        'DATABASE_URL: Es obligatoria',
      );
    });

    it('acepta postgresql:// y postgres://', () => {
      const url = 'postgres://usuario:clave@localhost:5432/utn_connect';
      expect(parseEnv({ ...VALID, DATABASE_URL: url }).DATABASE_URL).toBe(url);
    });

    it.each(['no-es-una-url', 'mysql://usuario:clave@localhost:3306/utn_connect'])(
      'rechaza %s',
      (value) => {
        expect(envError({ ...VALID, DATABASE_URL: value })).toContain('DATABASE_URL');
      },
    );
  });

  describe('CORS_ORIGINS', () => {
    it('es obligatoria', () => {
      expect(envError({ ...VALID, CORS_ORIGINS: undefined })).toContain('CORS_ORIGINS');
    });

    it('acepta varios orígenes separados por comas, con espacios', () => {
      const env = parseEnv({
        ...VALID,
        CORS_ORIGINS: 'http://localhost:5173, https://connect.example.edu.ar',
      });
      expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173', 'https://connect.example.edu.ar']);
    });

    it.each([
      ['vacía', ''],
      ['solo comas', ' , '],
      ['sin esquema', 'localhost:5173'],
      ['con barra final', 'http://localhost:5173/'],
      ['con ruta', 'http://localhost:5173/app'],
    ])('rechaza una lista %s', (_caso, value) => {
      expect(envError({ ...VALID, CORS_ORIGINS: value })).toContain('CORS_ORIGINS');
    });
  });
});
