import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { getTestDatabaseUrl, loadDotEnvFile } from './test-database-url.js';

/** Antes de las pruebas: valida `DATABASE_URL_TEST` y aplica las migraciones al esquema `test`. */
export default function setup() {
  loadDotEnvFile();
  const databaseUrl = getTestDatabaseUrl();

  // `migrate deploy` crea el esquema `test` si no existe. Se ejecuta el CLI de Prisma con el
  // mismo Node (sin `npx`) para que funcione igual en Windows, Linux y la integración continua.
  const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');
  try {
    execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });
  } catch (err) {
    const { stdout, stderr } = err as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `No se pudieron aplicar las migraciones al esquema \`test\`:\n${stdout?.toString() ?? ''}${stderr?.toString() ?? ''}`,
      { cause: err },
    );
  }
}
