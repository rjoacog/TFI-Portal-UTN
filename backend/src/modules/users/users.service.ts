import { AppError } from '../../shared/errors/index.js';
import { findProfileById, updateNames } from './users.repository.js';

/** Perfil tal como lo devuelve la API. */
export interface Profile {
  loginId: string;
  role: string;
  dni: string;
  firstName: string;
  lastName: string;
  email: string;
}

export async function getProfile(userId: number): Promise<Profile> {
  const profile = await findProfileById(userId);
  if (!profile) throw new AppError(404, 'NOT_FOUND', 'El recurso solicitado no existe');
  return profile;
}

/** Modifica nombre y apellido del propio usuario. Los demás datos no se tocan. */
export function updateProfile(
  userId: number,
  input: { firstName: string; lastName: string },
): Promise<Profile> {
  return updateNames(userId, input);
}
