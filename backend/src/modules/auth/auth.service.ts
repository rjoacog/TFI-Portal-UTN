import { UserStatus } from '@prisma/client';
import { signToken } from '../../shared/auth/index.js';
import { AppError } from '../../shared/errors/index.js';
import { normalizeLegajo } from '../../shared/identity/index.js';
import {
  findPasswordHashById,
  findPublicUserById,
  findUserByLoginId,
  incrementTokenVersion,
  runInTransaction,
} from './auth.repository.js';
import {
  hashPassword,
  setPassword,
  validateNewPassword,
  verifyPassword,
} from './password.service.js';

/** Usuario tal como lo devuelve la API de sesión. */
export interface SessionUser {
  id: number;
  loginId: string;
  role: string;
  firstName: string;
  lastName: string;
  email: string;
  mustChangePassword: boolean;
}

function toSessionUser(user: SessionUser): SessionUser {
  return {
    id: user.id,
    loginId: user.loginId,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    mustChangePassword: user.mustChangePassword,
  };
}

const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Credenciales no válidas');

// Hash ficticio para gastar el mismo tiempo cuando el legajo no existe.
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword('contraseña-ficticia-sin-usuario'));

/**
 * Inicio de sesión. Devuelve el usuario y el token firmado; la ruta escribe la cookie.
 * Una contraseña incorrecta responde siempre lo mismo, sin mirar el estado de la cuenta.
 */
export async function login(
  input: { loginId: string; password: string },
  jwtSecret: string,
): Promise<{ user: SessionUser; token: string }> {
  const user = await findUserByLoginId(normalizeLegajo(input.loginId));

  if (!user) {
    await verifyPassword(await getDummyHash(), input.password);
    throw invalidCredentials();
  }

  if (!(await verifyPassword(user.passwordHash, input.password))) throw invalidCredentials();

  if (user.status !== UserStatus.ACTIVE) {
    throw new AppError(
      403,
      'ACCOUNT_DISABLED',
      'La cuenta no está habilitada. Comunicate con la administración.',
    );
  }

  const token = signToken({ sub: user.id, tv: user.tokenVersion }, jwtSecret);
  return { user: toSessionUser(user), token };
}

/**
 * Cierre de sesión: incrementa `tokenVersion`, así el token deja de servir aunque alguien lo haya
 * copiado. Cierra también las sesiones de la misma cuenta en otros dispositivos.
 */
export async function logout(userId: number): Promise<void> {
  await incrementTokenVersion(userId);
}

/**
 * Cambio de contraseña propio (CU-03), obligatorio o voluntario. Verifica la actual, aplica la
 * política y escribe con `setPassword` (regla 7). Devuelve el usuario y un token con el
 * `tokenVersion` nuevo: las otras sesiones se cierran, la actual sigue con la cookie nueva (E1-2).
 */
export async function changePassword(
  userId: number,
  input: { currentPassword: string; newPassword: string },
  jwtSecret: string,
): Promise<{ user: SessionUser; token: string }> {
  const currentHash = await findPasswordHashById(userId);
  if (!currentHash)
    throw new AppError(401, 'UNAUTHENTICATED', 'Tenés que iniciar sesión para continuar');

  if (!(await verifyPassword(currentHash, input.currentPassword))) {
    throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'La contraseña actual no es correcta');
  }
  await validateNewPassword(input.newPassword, currentHash);

  const tokenVersion = await runInTransaction((tx) =>
    setPassword(tx, userId, input.newPassword, { mustChangePassword: false }),
  );

  const user = await getCurrentUser(userId);
  return { user, token: signToken({ sub: userId, tv: tokenVersion }, jwtSecret) };
}

/** Datos del usuario de la sesión actual. */
export async function getCurrentUser(userId: number): Promise<SessionUser> {
  const user = await findPublicUserById(userId);
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Tenés que iniciar sesión para continuar');
  return toSessionUser(user);
}
