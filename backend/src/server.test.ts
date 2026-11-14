import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const backendDir = path.resolve(import.meta.dirname, '..');

/**
 * Arranca `server.ts` en un proceso aparte.
 * Las variables que se pasan acá tienen prioridad sobre las del `.env` local.
 */
function startServer(env: Record<string, string>) {
  return spawnSync(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: backendDir,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout: 20_000,
  });
}

describe('arranque de la API', () => {
  it('no arranca si una variable de entorno es inválida, e indica cuál', () => {
    const result = startServer({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://usuario:clave@localhost:5432/utn_connect',
      CORS_ORIGINS: 'no-es-un-origen',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('CORS_ORIGINS');
    expect(result.stdout).not.toContain('API escuchando');
  }, 30_000);
});
