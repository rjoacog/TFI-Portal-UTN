import { UserStatus } from '@prisma/client';
import { prisma } from '../db/index.js';

/** Usuario con lo necesario para autenticar un pedido. */
export async function findUserForAuth(id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      tokenVersion: true,
      mustChangePassword: true,
      roles: { select: { role: { select: { name: true } } } },
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    isActive: user.status === UserStatus.ACTIVE,
    tokenVersion: user.tokenVersion,
    mustChangePassword: user.mustChangePassword,
    roles: user.roles.map((r) => r.role.name),
  };
}

/** ¿El usuario está asignado como docente a la comisión? */
export async function hasTeachingAssignment(userId: number, sectionId: number) {
  const assignment = await prisma.teachingAssignment.findUnique({
    where: { userId_sectionId: { userId, sectionId } },
    select: { id: true },
  });
  return assignment !== null;
}
