import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { RoleName } from '@prisma/client';
import { dniSchema, legajoSchema } from '../src/shared/identity/index.js';
import { z } from '../src/shared/validation/index.js';

const required = (value: unknown) => (value === undefined ? 'Es obligatoria' : undefined);

const seedEnvSchema = z.object({
  SEED_ADMIN_LOGIN_ID: z
    .string({ error: (issue) => required(issue.input) })
    .pipe(legajoSchema(RoleName.ADMIN)),
  SEED_ADMIN_DNI: z.string({ error: (issue) => required(issue.input) }).pipe(dniSchema),
  SEED_ADMIN_EMAIL: z.email({
    error: (issue) => required(issue.input) ?? 'Tiene que ser un correo válido',
  }),
  SEED_ADMIN_PASSWORD: z
    .string({ error: (issue) => required(issue.input) })
    .min(8, { error: 'Tiene que tener al menos 8 caracteres' }),
});

/** Carga `backend/.env` si existe. Las variables ya definidas en el entorno tienen prioridad. */
function loadDotEnvFile() {
  try {
    process.loadEnvFile();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

async function main() {
  loadDotEnvFile();

  const parsed = seedEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `  - ${String(issue.path[0])}: ${issue.message}`,
    );
    console.error(
      `No se puede crear el administrador. Variables inválidas:\n${problems.join('\n')}`,
    );
    process.exit(1);
  }
  const {
    SEED_ADMIN_LOGIN_ID: loginId,
    SEED_ADMIN_DNI: dni,
    SEED_ADMIN_EMAIL: email,
    SEED_ADMIN_PASSWORD,
  } = parsed.data;

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { loginId } });
    if (existing) {
      console.log(`Ya existe un usuario con loginId "${loginId}": no se crea de nuevo.`);
      return;
    }

    const passwordHash = await argon2.hash(SEED_ADMIN_PASSWORD);

    await prisma.user.create({
      data: {
        loginId,
        dni,
        role: RoleName.ADMIN,
        email,
        firstName: 'Administrador',
        lastName: 'Sistema',
        passwordHash,
        mustChangePassword: true,
      },
    });
    console.log(`Administrador "${loginId}" creado. Tiene que cambiar la contraseña al ingresar.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
