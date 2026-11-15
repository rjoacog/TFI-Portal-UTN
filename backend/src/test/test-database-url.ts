/** Carga `backend/.env` si existe. Las variables ya definidas en el entorno tienen prioridad. */
export function loadDotEnvFile() {
  try {
    process.loadEnvFile();
  } catch (err) {
    // Sin `.env` (por ejemplo, en la integración continua) se usan solo las variables del entorno.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

const HOW_TO_CONFIGURE = [
  'Las pruebas corren contra el esquema `test` de la base `utn_connect`, para no tocar los datos de desarrollo (esquema `public`).',
  'Agregá `DATABASE_URL_TEST` a `backend/.env`: es la misma conexión que `DATABASE_URL`, con `?schema=test` al final.',
  'Por ejemplo: DATABASE_URL_TEST="postgresql://USUARIO:CONTRASEÑA@localhost:5432/utn_connect?schema=test"',
].join('\n');

export class TestDatabaseConfigError extends Error {
  constructor(problem: string) {
    super(`No se pueden correr las pruebas: ${problem}\n\n${HOW_TO_CONFIGURE}`);
    this.name = 'TestDatabaseConfigError';
  }
}

/**
 * Valida `DATABASE_URL_TEST` y la devuelve. Si falta, no es una URL de PostgreSQL o no indica
 * `schema=test`, lanza `TestDatabaseConfigError`: así ninguna prueba puede tocar el esquema `public`.
 */
export function getTestDatabaseUrl(source: Record<string, string | undefined> = process.env) {
  const value = source.DATABASE_URL_TEST;
  if (value === undefined || value.trim() === '') {
    throw new TestDatabaseConfigError('falta la variable `DATABASE_URL_TEST`.');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TestDatabaseConfigError('`DATABASE_URL_TEST` no es una URL válida.');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new TestDatabaseConfigError(
      '`DATABASE_URL_TEST` tiene que ser una URL de PostgreSQL (postgresql://...).',
    );
  }
  if (url.searchParams.get('schema') !== 'test') {
    throw new TestDatabaseConfigError('`DATABASE_URL_TEST` tiene que indicar `schema=test`.');
  }
  return value;
}
