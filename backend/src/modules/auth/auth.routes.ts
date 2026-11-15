import { Router, type Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import {
  allowPasswordChangePending,
  clearSessionCookie,
  createRequireAuth,
  setSessionCookie,
} from '../../shared/auth/index.js';
import { AppError } from '../../shared/errors/index.js';
import { normalizeLegajo } from '../../shared/identity/index.js';
import { z } from '../../shared/validation/index.js';
import { changePassword, getCurrentUser, login, logout } from './auth.service.js';

/** Límite de intentos fallidos de inicio de sesión (decisión E1-1). */
export interface LoginRateLimit {
  windowMs: number;
  /** Fallidos por legajo (normalizado) dentro de la ventana. */
  perLoginId: number;
  /** Fallidos por IP dentro de la ventana. */
  perIp: number;
}

export const DEFAULT_LOGIN_RATE_LIMIT: LoginRateLimit = {
  windowMs: 15 * 60 * 1000,
  perLoginId: 5,
  perIp: 50,
};

const loginSchema = z.object({
  loginId: z.string().min(1),
  password: z.string().min(1),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(1),
    newPasswordConfirmation: z.string().min(1),
  })
  .refine((v) => v.newPassword === v.newPasswordConfirmation, {
    path: ['newPasswordConfirmation'],
    message: 'La confirmación no coincide con la nueva contraseña',
  });

const tooManyAttempts = () =>
  new AppError(
    429,
    'TOO_MANY_LOGIN_ATTEMPTS',
    'Hiciste demasiados intentos fallidos. Esperá 15 minutos y volvé a intentar.',
  );

const ipKey = (req: Request) => ipKeyGenerator(req.ip ?? '');

export interface AuthRouterOptions {
  jwtSecret: string;
  secureCookies: boolean;
  loginRateLimit?: LoginRateLimit;
}

export function createAuthRouter({
  jwtSecret,
  secureCookies,
  loginRateLimit = DEFAULT_LOGIN_RATE_LIMIT,
}: AuthRouterOptions) {
  const router = Router();
  const requireAuth = createRequireAuth(jwtSecret);

  const common = {
    windowMs: loginRateLimit.windowMs,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req: Request, _res: unknown, next: (err: unknown) => void) =>
      next(tooManyAttempts()),
  } as const;

  // Clave por legajo normalizado: `ALU1` y `alu1` cuentan juntos. Sin legajo usable, cae a la IP.
  const loginIdKey = (req: Request) => {
    const loginId: unknown = req.body?.loginId;
    return typeof loginId === 'string' && loginId.trim() !== ''
      ? `login:${normalizeLegajo(loginId)}`
      : `ip:${ipKey(req)}`;
  };

  const perLoginId = rateLimit({
    ...common,
    limit: loginRateLimit.perLoginId,
    keyGenerator: loginIdKey,
  });
  // Va después del límite por legajo: los rechazos de aquel no gastan el cupo de la IP.
  const perIp = rateLimit({ ...common, limit: loginRateLimit.perIp, keyGenerator: ipKey });

  router.post('/login', perLoginId, perIp, async (req, res) => {
    const input = loginSchema.parse(req.body);
    const { user, token } = await login(input, jwtSecret);
    // Un ingreso correcto reinicia el contador: el límite es de intentos seguidos.
    await perLoginId.resetKey(loginIdKey(req));
    setSessionCookie(res, token, secureCookies);
    res.status(200).json({ user });
  });

  router.get('/me', allowPasswordChangePending, requireAuth, async (req, res) => {
    const user = await getCurrentUser((req.user as { id: number }).id);
    res.status(200).json({ user });
  });

  // Cambio propio de contraseña. Se permite con `mustChangePassword`: es justamente lo que se pide.
  // El id sale de la sesión, nunca del cuerpo.
  router.post('/password', allowPasswordChangePending, requireAuth, async (req, res) => {
    const input = passwordSchema.parse(req.body);
    const { user, token } = await changePassword((req.user as { id: number }).id, input, jwtSecret);
    setSessionCookie(res, token, secureCookies);
    res.status(200).json({ user });
  });

  // Se permite con `mustChangePassword`: cerrar sesión no está bloqueado por el cambio pendiente.
  router.post('/logout', allowPasswordChangePending, requireAuth, async (req, res) => {
    await logout((req.user as { id: number }).id);
    clearSessionCookie(res, secureCookies);
    res.status(204).end();
  });

  return router;
}
