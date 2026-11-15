import { UserStatus } from '@prisma/client';
import { signToken } from '../../shared/auth/index.js';
import { AppError } from '../../shared/errors/index.js';
import { normalizeLegajo } from '../../shared/identity/index.js';
import { findPublicUserById, findUserByLoginId } from './auth.repository.js';
import { hashPassword, verifyPassword } from './password.service.js';

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

/** Datos del usuario de la sesión actual. */
export async function getCurrentUser(userId: number): Promise<SessionUser> {
  const user = await findPublicUserById(userId);
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'Tenés que iniciar sesión para continuar');
  return toSessionUser(user);
}
