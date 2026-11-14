import { createApp } from './app.js';
import { EnvValidationError, parseEnv, type Env } from './shared/config/env.js';

/** Carga `backend/.env` si existe. Las variables ya definidas en el entorno tienen prioridad. */
function loadDotEnvFile() {
  try {
    process.loadEnvFile();
  } catch (err) {
    // Sin `.env` (por ejemplo, en la integración continua) se usan solo las variables del entorno.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

function loadEnvOrExit(): Env {
  try {
    return parseEnv(process.env);
  } catch (err) {
    if (err instanceof EnvValidationError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
}

loadDotEnvFile();
const env = loadEnvOrExit();
const app = createApp({ corsOrigins: env.CORS_ORIGINS });

app.listen(env.PORT, () => {
  console.log(`API escuchando en el puerto ${env.PORT} (${env.NODE_ENV})`);
});
