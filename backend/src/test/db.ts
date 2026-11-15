import { RoleName } from '@prisma/client';
import { prisma } from '../shared/db/index.js';

/** Valores iniciales de la fila única de `settings`, tal como los carga la primera migración. */
const INITIAL_SETTINGS = {
  currentTermId: null,
  maxFileSizeBytes: 10485760,
  allowedMimeTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'image/jpeg',
    'image/png',
  ],
};

/**
 * Deja la base como después de migrar: vacía todas las tablas, salvo `roles` y `settings`
 * (datos base de la migración), y devuelve `settings` a sus valores iniciales.
 */
export async function resetDatabase() {
  // `settings` apunta a `academic_terms`: se libera antes de vaciarla.
  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, ...INITIAL_SETTINGS },
    update: INITIAL_SETTINGS,
  });

  // La lista sale de la base, así las tablas nuevas entran solas en la limpieza.
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = current_schema()
      AND tablename NOT IN ('roles', 'settings', 'academic_terms', '_prisma_migrations')`;
  if (tables.length > 0) {
    const names = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
  }

  // `TRUNCATE` no sirve para `academic_terms` porque `settings` la referencia.
  await prisma.academicTerm.deleteMany();
  await prisma.$executeRawUnsafe('ALTER SEQUENCE "academic_terms_id_seq" RESTART WITH 1');
}

let userCounter = 0;

type CreateUserOptions = {
  roles?: RoleName[];
  loginId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

/** Crea un usuario con los roles indicados (por defecto, ninguno). Los datos únicos se generan solos. */
export async function createUser({ roles = [], ...overrides }: CreateUserOptions = {}) {
  userCounter += 1;
  const roleRows = await prisma.role.findMany({ where: { name: { in: roles } } });
  return prisma.user.create({
    data: {
      loginId: `user${userCounter}`,
      email: `user${userCounter}@test.local`,
      firstName: 'Nombre',
      lastName: 'Apellido',
      // No es un hash real: las pruebas que necesiten uno válido lo generan con argon2.
      passwordHash: 'hash-de-prueba',
      ...overrides,
      roles: { create: roleRows.map((role) => ({ roleId: role.id })) },
    },
    include: { roles: { include: { role: true } } },
  });
}
