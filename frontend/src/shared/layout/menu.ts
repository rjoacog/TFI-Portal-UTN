import type { Role } from '../session';

export interface MenuItem {
  to: string;
  label: string;
  description: string;
}

/** Rol en texto, para mostrarlo al usuario. */
export const ROLE_LABEL: Record<Role, string> = {
  STUDENT: 'Alumno',
  TEACHER: 'Docente',
  ADMIN: 'Administrador',
  DIRECTOR: 'Directivo',
};

const COMMON_ITEMS: MenuItem[] = [
  { to: '/profile', label: 'Mi perfil', description: 'Tus datos personales.' },
  { to: '/change-password', label: 'Cambiar contraseña', description: 'Actualizá tu contraseña.' },
];

/**
 * Opciones de la pantalla de inicio de cada rol. Cada etapa suma las suyas
 * (por ejemplo, *Usuarios* para el administrador en CU-05).
 */
export const ROLE_MENU: Record<Role, MenuItem[]> = {
  STUDENT: [...COMMON_ITEMS],
  TEACHER: [...COMMON_ITEMS],
  ADMIN: [...COMMON_ITEMS],
  // El directivo no tiene pantallas propias en la versión 1.
  DIRECTOR: [...COMMON_ITEMS],
};
