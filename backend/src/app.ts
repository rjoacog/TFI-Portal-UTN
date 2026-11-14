import './shared/validation/index.js';
import cors from 'cors';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { healthRouter } from './modules/health/health.routes.js';
import { AppError, errorHandler, notFoundHandler } from './shared/errors/index.js';

/**
 * Límite global de pedidos por IP.
 * Es generoso a propósito: en un laboratorio, muchos alumnos pueden salir a internet con la misma IP.
 */
export const DEFAULT_RATE_LIMIT = { windowMs: 15 * 60 * 1000, limit: 1000 };

export interface AppOptions {
  /** Orígenes permitidos para CORS (viene de `CORS_ORIGINS`). */
  corsOrigins: string[];
  /** Permite cambiar el límite global, por ejemplo en las pruebas. */
  rateLimit?: { windowMs: number; limit: number };
}

/** Crea la aplicación sin levantar el servidor, para poder probarla con Supertest. */
export function createApp({ corsOrigins, rateLimit: limits = DEFAULT_RATE_LIMIT }: AppOptions) {
  const app: Express = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(
    rateLimit({
      windowMs: limits.windowMs,
      limit: limits.limit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, _res, next) => {
        next(
          new AppError(
            429,
            'TOO_MANY_REQUESTS',
            'Hiciste demasiados pedidos. Esperá unos minutos y volvé a intentar.',
          ),
        );
      },
    }),
  );
  app.use(express.json());

  app.use('/api/health', healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
