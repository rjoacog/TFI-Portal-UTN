import type { CookieOptions, Response } from 'express';
import { SESSION_TTL_SECONDS } from './token.js';

/** Nombre de la cookie de sesión. */
export const SESSION_COOKIE_NAME = 'utn_session';

/** `Secure` solo en producción: en desarrollo la web y la API van por http. */
function cookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure, path: '/' };
}

/** Escribe la cookie de sesión (8 horas). */
export function setSessionCookie(res: Response, token: string, secure: boolean) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...cookieOptions(secure),
    maxAge: SESSION_TTL_SECONDS * 1000,
  });
}

/** Borra la cookie de sesión. */
export function clearSessionCookie(res: Response, secure: boolean) {
  res.clearCookie(SESSION_COOKIE_NAME, cookieOptions(secure));
}
