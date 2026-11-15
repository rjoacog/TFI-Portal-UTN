import type { Prisma } from '@prisma/client';
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

/** Incrementa `tokenVersion`: los tokens ya emitidos dejan de servir. */
export async function incrementTokenVersion(id: number) {
  await prisma.user.update({ where: { id }, data: { tokenVersion: { increment: 1 } } });
}

/** Hash de la contraseña actual, para verificarla antes de cambiarla. */
export async function findPasswordHashById(id: number): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id }, select: { passwordHash: true } });
  return user?.passwordHash ?? null;
}

/** Ejecuta `fn` dentro de una transacción de la base. */
export function runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}

/** Datos públicos del usuario (nunca `passwordHash` ni `tokenVersion`). */
export function findPublicUserById(id: number) {
  return prisma.user.findUnique({ where: { id }, select: userSelect });
}
