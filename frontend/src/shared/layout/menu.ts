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
 * Opciones de la pantalla de inicio de cada rol.
 */
export const ROLE_MENU: Record<Role, MenuItem[]> = {
  STUDENT: [
    { to: '/offer', label: 'Oferta', description: 'Comisiones abiertas del período vigente.' },
    { to: '/history', label: 'Historial', description: 'Tus notas y tu asistencia.' },
    ...COMMON_ITEMS,
  ],
  TEACHER: [
    { to: '/teaching', label: 'Mis comisiones', description: 'El aula de las comisiones que tenés asignadas.' },
    ...COMMON_ITEMS,
  ],
  ADMIN: [
    { to: '/users', label: 'Usuarios', description: 'Altas, estados y contraseñas.' },
    { to: '/programs', label: 'Carreras', description: 'Carreras de la oferta.' },
    { to: '/subjects', label: 'Materias', description: 'Materias de cada carrera.' },
    { to: '/terms', label: 'Períodos', description: 'Años y cuatrimestres.' },
    { to: '/sections', label: 'Comisiones', description: 'Abrir y cerrar comisiones.' },
    { to: '/settings', label: 'Parámetros', description: 'Período vigente y archivos.' },
    ...COMMON_ITEMS,
  ],
  // El directivo no tiene pantallas propias en la versión 1.
  DIRECTOR: [...COMMON_ITEMS],
};
