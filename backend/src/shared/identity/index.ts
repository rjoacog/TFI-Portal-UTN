import { RoleName } from '@prisma/client';
import { z } from '../validation/index.js';

/** Prefijo del legajo de cada rol. */
export const LEGAJO_PREFIX = {
  [RoleName.STUDENT]: 'alu',
  [RoleName.TEACHER]: 'doc',
  [RoleName.ADMIN]: 'adm',
  [RoleName.DIRECTOR]: 'dir',
} as const satisfies Record<RoleName, string>;

/** Arma el legajo con el prefijo del rol y el número. Por ejemplo, `TEACHER` + `12345` da `doc12345`. */
export function buildLegajo(role: RoleName, number: string | number): string {
  return `${LEGAJO_PREFIX[role]}${number}`;
}

/** Normaliza el legajo escrito al iniciar sesión: sin espacios en los extremos y en minúscula. */
export function normalizeLegajo(input: string): string {
  return input.trim().toLowerCase();
}

/** ¿El legajo tiene el prefijo del rol seguido solo de dígitos? Espera el legajo ya normalizado. */
export function isValidLegajo(legajo: string, role: RoleName): boolean {
  const match = /^([a-z]+)(\d+)$/.exec(legajo);
  return match !== null && match[1] === LEGAJO_PREFIX[role];
}

/** Legajo ya normalizado y válido para el rol. */
export function legajoSchema(role: RoleName) {
  return z
    .string()
    .transform(normalizeLegajo)
    .refine((legajo) => isValidLegajo(legajo, role), {
      error: `El legajo tiene que ser "${LEGAJO_PREFIX[role]}" seguido solo de dígitos`,
    });
}

/** DNI: 7 u 8 dígitos, sin puntos. */
export const dniSchema = z
  .string()
  .regex(/^\d{7,8}$/, { error: 'El DNI tiene que tener 7 u 8 dígitos, sin puntos' });
