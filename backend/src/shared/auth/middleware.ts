import type { RoleName } from '@prisma/client';
import type { RequestHandler } from 'express';
import { AppError } from '../errors/index.js';
import { findUserForAuth } from './auth.repository.js';
import { SESSION_COOKIE_NAME } from './cookie.js';
import { verifyToken } from './token.js';

/** Datos del usuario autenticado que `requireAuth` deja en `req.user`. */
export interface AuthUser {
  id: number;
  roles: RoleName[];
  mustChangePassword: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
  interface Locals {
    /** Lo marca `allowPasswordChangePending`: la ruta se puede usar con `mustChangePassword`. */
    allowPasswordChangePending?: boolean;
  }
}

const unauthenticated = () =>
  new AppError(401, 'UNAUTHENTICATED', 'Tenés que iniciar sesión para continuar');

/**
 * Marca la ruta como permitida aunque el usuario tenga `mustChangePassword`
 * (cambiar la contraseña y cerrar sesión). Se pone **antes** de `requireAuth`.
 */
export const allowPasswordChangePending: RequestHandler = (_req, res, next) => {
  res.locals.allowPasswordChangePending = true;
  next();
};

/**
 * Exige una sesión válida: lee el token de la cookie, lo verifica y comprueba que el usuario
 * esté activo y que `tv` coincida con su `tokenVersion`. Si no, responde 401 `UNAUTHENTICATED`.
 * Con `mustChangePassword`, responde 403 `PASSWORD_CHANGE_REQUIRED` salvo en las rutas permitidas.
 */
export function createRequireAuth(jwtSecret: string): RequestHandler {
  return async (req, res, next) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE_NAME];
    if (typeof token !== 'string' || token === '') throw unauthenticated();

    const payload = verifyToken(token, jwtSecret);
    if (!payload) throw unauthenticated();

    const user = await findUserForAuth(payload.sub);
    if (!user || !user.isActive || user.tokenVersion !== payload.tv) throw unauthenticated();

    if (user.mustChangePassword && !res.locals.allowPasswordChangePending) {
      throw new AppError(
        403,
        'PASSWORD_CHANGE_REQUIRED',
        'Tenés que cambiar tu contraseña antes de continuar',
      );
    }

    req.user = { id: user.id, roles: user.roles, mustChangePassword: user.mustChangePassword };
    next();
  };
}

/** Exige que el usuario tenga alguno de los roles. Va después de `requireAuth`. */
export function requireRole(...roles: RoleName[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw unauthenticated();
    if (!req.user.roles.some((role) => roles.includes(role))) {
      throw new AppError(403, 'FORBIDDEN', 'No tenés permiso para realizar esta acción');
    }
    next();
  };
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Defensa contra CSRF: en los pedidos que modifican datos, rechaza un `Origin` que no esté
 * permitido. Sin cabecera `Origin` se acepta: los navegadores siempre la envían en estos pedidos,
 * así que solo faltaría en herramientas como Postman o curl.
 */
export function createOriginCheck(allowedOrigins: string[]): RequestHandler {
  return (req, _res, next) => {
    const origin = req.get('Origin');
    if (
      MUTATING_METHODS.has(req.method) &&
      origin !== undefined &&
      !allowedOrigins.includes(origin)
    ) {
      throw new AppError(403, 'FORBIDDEN_ORIGIN', 'El origen del pedido no está permitido');
    }
    next();
  };
}
