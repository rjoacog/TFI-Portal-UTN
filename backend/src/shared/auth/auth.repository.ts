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
      role: true,
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    isActive: user.status === UserStatus.ACTIVE,
    tokenVersion: user.tokenVersion,
    mustChangePassword: user.mustChangePassword,
    role: user.role,
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
