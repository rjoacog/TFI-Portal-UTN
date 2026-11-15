import { randomInt } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import argon2 from 'argon2';
import { AppError } from '../../shared/errors/index.js';

// Servicio único de contraseñas (regla 7 de CLAUDE.md). Es el único lugar que hashea,
// valida la política y escribe `passwordHash`. Lo usan el cambio obligatorio y el
// voluntario (CU-03), el alta (CU-05), el restablecimiento (CU-07) y los seeds.

/** Largo mínimo de la política de contraseñas (N2). */
export const PASSWORD_MIN_LENGTH = 8;

/** Largo de la contraseña temporal. */
export const TEMPORARY_PASSWORD_LENGTH = 12;

/** Alfabeto de la contraseña temporal: sin `0/O` ni `1/l/I`, que se confunden al copiarlos. */
export const TEMPORARY_PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** Hashea con argon2id, con los parámetros por defecto de la librería. */
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

/**
 * Devuelve `true` si `plain` corresponde a `hash`. Una contraseña incorrecta devuelve `false`;
 * un hash con formato inválido también, porque no hay contraseña que pueda coincidir con él.
 */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/**
 * Aplica la política de contraseñas (N2): al menos 8 caracteres y, si se pasa
 * `currentHash`, distinta de la actual. Si no la cumple, lanza un `AppError` 400.
 */
export async function validateNewPassword(plain: string, currentHash?: string): Promise<void> {
  if (plain.length < PASSWORD_MIN_LENGTH) {
    throw new AppError(
      400,
      'PASSWORD_TOO_SHORT',
      `La contraseña tiene que tener al menos ${PASSWORD_MIN_LENGTH} caracteres`,
    );
  }
  if (currentHash !== undefined && (await verifyPassword(currentHash, plain))) {
    throw new AppError(
      400,
      'PASSWORD_REUSED',
      'La nueva contraseña tiene que ser distinta de la actual',
    );
  }
}

/**
 * Único punto que escribe `passwordHash`. Guarda el hash de `plain`, fija `mustChangePassword`
 * e incrementa `tokenVersion` (E1-2): las sesiones anteriores dejan de servir.
 *
 * Recibe la transacción de quien llama, para que pueda escribir la auditoría en la misma
 * transacción. No valida la política: quien llama decide si aplica `validateNewPassword`.
 *
 * Devuelve el `tokenVersion` nuevo, para firmar una cookie nueva.
 */
export async function setPassword(
  tx: Prisma.TransactionClient,
  userId: number,
  plain: string,
  { mustChangePassword }: { mustChangePassword: boolean },
): Promise<number> {
  const passwordHash = await hashPassword(plain);
  const { tokenVersion } = await tx.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword, tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  });
  return tokenVersion;
}

/** Contraseña temporal al azar (regla 3), generada con `crypto.randomInt`. Cumple la política. */
export function generateTemporaryPassword(): string {
  let password = '';
  for (let i = 0; i < TEMPORARY_PASSWORD_LENGTH; i += 1) {
    password += TEMPORARY_PASSWORD_ALPHABET[randomInt(TEMPORARY_PASSWORD_ALPHABET.length)];
  }
  return password;
}
