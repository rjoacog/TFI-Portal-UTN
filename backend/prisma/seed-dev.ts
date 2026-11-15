import { PrismaClient, type RoleName, type TeachingPosition } from '@prisma/client';
import { hashPassword } from '../src/modules/auth/password.service.js';
import { buildLegajo } from '../src/shared/identity/index.js';
import { z } from '../src/shared/validation/index.js';

// Datos ficticios SOLO para desarrollo. Se puede ejecutar varias veces: cada registro
// se busca por su clave natural (loginId, código de materia, etc.) y solo se crea si falta.

const seedDevEnvSchema = z.object({
  SEED_DEV_PASSWORD: z
    .string({ error: (issue) => (issue.input === undefined ? 'Es obligatoria' : undefined) })
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

interface ProgramSeed {
  key: string;
  name: string;
  location: string;
  subjects: { code: string; name: string }[];
}

const PROGRAMS: ProgramSeed[] = [
  {
    key: 'tup',
    name: 'Tecnicatura Universitaria en Programación',
    location: 'Sede Ficticia Centro',
    subjects: [
      { code: 'PROG1', name: 'Programación I' },
      { code: 'MATE1', name: 'Matemática' },
      { code: 'BD1', name: 'Bases de Datos' },
      { code: 'ING1', name: 'Inglés Técnico' },
    ],
  },
  {
    key: 'tusi',
    name: 'Tecnicatura Universitaria en Sistemas Informáticos',
    location: 'Sede Ficticia Norte',
    subjects: [
      { code: 'ARQ1', name: 'Arquitectura de Computadoras' },
      { code: 'RED1', name: 'Redes' },
      { code: 'SO1', name: 'Sistemas Operativos' },
    ],
  },
];

interface SectionSeed {
  program: string;
  subjectCode: string;
  name: string;
  lead: string;
  assistant?: string;
}

const SECTIONS: SectionSeed[] = [
  { program: 'tup', subjectCode: 'PROG1', name: 'Comisión A', lead: 'doc1', assistant: 'doc2' },
  { program: 'tup', subjectCode: 'MATE1', name: 'Comisión A', lead: 'doc2' },
  { program: 'tup', subjectCode: 'BD1', name: 'Comisión A', lead: 'doc1' },
  { program: 'tusi', subjectCode: 'RED1', name: 'Comisión A', lead: 'doc2' },
  { program: 'tusi', subjectCode: 'SO1', name: 'Comisión A', lead: 'doc3' },
];

interface UserSeed {
  /** Legajo: el prefijo lo pone `buildLegajo` según el rol. */
  number: string;
  dni: string;
  firstName: string;
  lastName: string;
  role: RoleName;
  programs?: string[];
  disabled?: boolean;
}

const USERS: UserSeed[] = [
  { number: '1', dni: '20000001', firstName: 'Laura', lastName: 'Gómez', role: 'TEACHER' },
  { number: '2', dni: '20000002', firstName: 'Martín', lastName: 'Suárez', role: 'TEACHER' },
  { number: '10001', dni: '30000001', firstName: 'Ana', lastName: 'Pérez', role: 'STUDENT', programs: ['tup'] },
  { number: '10002', dni: '30000002', firstName: 'Bruno', lastName: 'Díaz', role: 'STUDENT', programs: ['tup'] },
  { number: '10003', dni: '30000003', firstName: 'Camila', lastName: 'Ruiz', role: 'STUDENT', programs: ['tusi'] },
  { number: '10004', dni: '30000004', firstName: 'Diego', lastName: 'Torres', role: 'STUDENT', programs: ['tusi'] },
  // Cursa las dos carreras.
  { number: '10005', dni: '30000005', firstName: 'Elena', lastName: 'Castro', role: 'STUDENT', programs: ['tup', 'tusi'] },
  { number: '1', dni: '40000001', firstName: 'Ricardo', lastName: 'Vega', role: 'DIRECTOR' },
  // Una persona con dos roles: dos cuentas con el mismo DNI (`doc3` y `alu10006`). Sirven para
  // probar que nadie es docente y alumno de la misma comisión.
  { number: '3', dni: '50000001', firstName: 'Julia', lastName: 'Romero', role: 'TEACHER' },
  { number: '10006', dni: '50000001', firstName: 'Julia', lastName: 'Romero', role: 'STUDENT', programs: ['tup'] },
  // Para probar el mensaje "La cuenta no está habilitada".
  { number: '10099', dni: '30000099', firstName: 'Sergio', lastName: 'Baja', role: 'STUDENT', programs: ['tup'], disabled: true },
];

/** Cuatrimestre actual: el 1 va de enero a julio y el 2, de agosto a diciembre. */
function currentTerm(now = new Date()) {
  return { year: now.getUTCFullYear(), term: now.getUTCMonth() < 7 ? 1 : 2 };
}

async function main() {
  loadDotEnvFile();

  if (process.env.NODE_ENV === 'production') {
    console.error('db:seed:dev no se ejecuta con NODE_ENV=production: son datos solo para desarrollo.');
    return;
  }

  const parsed = seedDevEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(
      (issue) => `  - ${String(issue.path[0])}: ${issue.message}`,
    );
    console.error(`No se pueden cargar los datos de prueba. Variables inválidas:\n${problems.join('\n')}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    // La fila de `Settings` la inserta la primera migración.
    const passwordHash = await hashPassword(parsed.data.SEED_DEV_PASSWORD);

    // Carreras y materias.
    const programIds = new Map<string, number>();
    const subjectIds = new Map<string, number>();
    for (const p of PROGRAMS) {
      const program =
        (await prisma.program.findFirst({ where: { name: p.name, location: p.location } })) ??
        (await prisma.program.create({ data: { name: p.name, location: p.location } }));
      programIds.set(p.key, program.id);
      for (const s of p.subjects) {
        const subject = await prisma.subject.upsert({
          where: { programId_code: { programId: program.id, code: s.code } },
          update: {},
          create: { programId: program.id, code: s.code, name: s.name },
        });
        subjectIds.set(`${p.key}:${s.code}`, subject.id);
      }
    }

    // Período vigente.
    const { year, term } = currentTerm();
    const academicTerm = await prisma.academicTerm.upsert({
      where: { year_term: { year, term } },
      update: {},
      create: { year, term },
    });
    await prisma.settings.update({ where: { id: 1 }, data: { currentTermId: academicTerm.id } });

    // Usuarios (una cuenta por legajo, con un solo rol) y carreras.
    const userIds = new Map<string, number>();
    for (const u of USERS) {
      const loginId = buildLegajo(u.role, u.number);
      const user = await prisma.user.upsert({
        where: { loginId },
        update: {},
        create: {
          loginId,
          role: u.role,
          dni: u.dni,
          email: `${loginId}@dev.utn-connect.test`,
          firstName: u.firstName,
          lastName: u.lastName,
          passwordHash,
          mustChangePassword: false,
          status: u.disabled ? 'DISABLED' : 'ACTIVE',
        },
      });
      userIds.set(loginId, user.id);
      for (const key of u.programs ?? []) {
        const programId = programIds.get(key)!;
        await prisma.studentProgram.upsert({
          where: { userId_programId: { userId: user.id, programId } },
          update: {},
          create: { userId: user.id, programId },
        });
      }
    }

    // Comisiones abiertas, con aula y docentes.
    for (const s of SECTIONS) {
      const subjectId = subjectIds.get(`${s.program}:${s.subjectCode}`)!;
      const section = await prisma.section.upsert({
        where: { subjectId_termId_name: { subjectId, termId: academicTerm.id, name: s.name } },
        update: {},
        create: { subjectId, termId: academicTerm.id, name: s.name, status: 'OPEN' },
      });
      await prisma.classroom.upsert({
        where: { sectionId: section.id },
        update: {},
        create: { sectionId: section.id },
      });
      const staff: [string, TeachingPosition][] = [[s.lead, 'LEAD']];
      if (s.assistant) staff.push([s.assistant, 'ASSISTANT']);
      for (const [loginId, position] of staff) {
        const userId = userIds.get(loginId)!;
        await prisma.teachingAssignment.upsert({
          where: { userId_sectionId: { userId, sectionId: section.id } },
          update: {},
          create: { userId, sectionId: section.id, position },
        });
      }
    }

    console.log(
      `Datos de prueba listos: ${PROGRAMS.length} carreras, período ${year}-C${term}, ` +
        `${SECTIONS.length} comisiones y ${USERS.length} usuarios.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
