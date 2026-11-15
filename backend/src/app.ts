import './shared/validation/index.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { createAuthRouter, type LoginRateLimit } from './modules/auth/auth.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { createUsersRouter } from './modules/users/users.routes.js';
import { createOriginCheck } from './shared/auth/index.js';
import { AppError, errorHandler, notFoundHandler } from './shared/errors/index.js';

/**
 * Límite global de pedidos por IP.
 * Es generoso a propósito: en un laboratorio, muchos alumnos pueden salir a internet con la misma IP.
 */
export const DEFAULT_RATE_LIMIT = { windowMs: 15 * 60 * 1000, limit: 1000 };

export interface AppOptions {
  /** Orígenes permitidos para CORS (viene de `CORS_ORIGINS`). */
  corsOrigins: string[];
  /** Secreto para firmar los tokens (viene de `JWT_SECRET`). */
  jwtSecret: string;
  /** Marca `Secure` en la cookie de sesión (solo en producción). */
  secureCookies?: boolean;
  /** Permite cambiar el límite global, por ejemplo en las pruebas. */
  rateLimit?: { windowMs: number; limit: number };
  /** Permite cambiar el límite de intentos fallidos de inicio de sesión (E1-1). */
  loginRateLimit?: LoginRateLimit;
}

/** Crea la aplicación sin levantar el servidor, para poder probarla con Supertest. */
export function createApp({
  corsOrigins,
  jwtSecret,
  secureCookies = false,
  rateLimit: limits = DEFAULT_RATE_LIMIT,
  loginRateLimit,
}: AppOptions) {
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
  app.use(cookieParser());
  // Defensa contra CSRF: va antes de las rutas.
  app.use(createOriginCheck(corsOrigins));

  // Ninguna respuesta de la API se guarda: al volver atrás el navegador no muestra datos viejos.
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use('/api/health', healthRouter);
  app.use('/api/auth', createAuthRouter({ jwtSecret, secureCookies, loginRateLimit }));
  app.use('/api/users', createUsersRouter({ jwtSecret }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
