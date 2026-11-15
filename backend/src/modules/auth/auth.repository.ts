import { prisma } from '../../shared/db/index.js';

const userSelect = {
  id: true,
  loginId: true,
  role: true,
  firstName: true,
  lastName: true,
  email: true,
  mustChangePassword: true,
} as const;

/** Usuario por legajo ya normalizado, con lo necesario para verificar el ingreso. */
export function findUserByLoginId(loginId: string) {
  return prisma.user.findUnique({
    where: { loginId },
    select: { ...userSelect, passwordHash: true, status: true, tokenVersion: true },
  });
}

/** Datos públicos del usuario (nunca `passwordHash` ni `tokenVersion`). */
export function findPublicUserById(id: number) {
  return prisma.user.findUnique({ where: { id }, select: userSelect });
}
