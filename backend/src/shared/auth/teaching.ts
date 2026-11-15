import { RoleName } from '@prisma/client';
import { AppError } from '../errors/index.js';
import { hasTeachingAssignment } from './auth.repository.js';
import type { AuthUser } from './middleware.js';

/**
 * Verifica que el usuario sea docente y esté asignado a la comisión (`TeachingAssignment`).
 * Si no, responde 404 `NOT_FOUND`, para no revelar que la comisión existe.
 */
export async function assertTeachingAssignment(user: AuthUser, sectionId: number) {
  const isAssigned =
    user.role === RoleName.TEACHER && (await hasTeachingAssignment(user.id, sectionId));
  if (!isAssigned) {
    throw new AppError(404, 'NOT_FOUND', 'El recurso solicitado no existe');
  }
}
