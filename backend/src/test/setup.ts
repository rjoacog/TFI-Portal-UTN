import { getTestDatabaseUrl, loadDotEnvFile } from './test-database-url.js';

// Se ejecuta antes de cada archivo de pruebas, y antes de que se cree el cliente de Prisma
// (`src/shared/db`): desde acá el cliente apunta al esquema `test`, nunca a `public`.
loadDotEnvFile();
process.env.DATABASE_URL = getTestDatabaseUrl();
