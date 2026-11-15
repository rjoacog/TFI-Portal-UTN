import { prisma } from '../../shared/db/index.js';

const profileSelect = {
  loginId: true,
  role: true,
  dni: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

/** Datos del perfil de un usuario. */
export function findProfileById(id: number) {
  return prisma.user.findUnique({ where: { id }, select: profileSelect });
}

/** Cambia nombre y apellido. Es lo único que el perfil permite modificar. */
export function updateNames(id: number, data: { firstName: string; lastName: string }) {
  return prisma.user.update({ where: { id }, data, select: profileSelect });
}
