import { Prisma, ProgramStatus, RoleName, SectionStatus, SubjectStatus, TeachingPosition, UserStatus } from '@prisma/client';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/errors/index.js';

const notFound = () => new AppError(404, 'NOT_FOUND', 'El recurso solicitado no existe');

function uniqueConflict(err: unknown, code: string, message: string): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw new AppError(409, code, message);
  }
  throw err;
}

export async function listPrograms() {
  return prisma.program.findMany({ orderBy: { name: 'asc' } });
}

export async function createProgram(input: { name: string; location: string }) {
  return prisma.program.create({ data: input });
}

export async function setProgramStatus(id: number, status: ProgramStatus) {
  try {
    return await prisma.program.update({ where: { id }, data: { status } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') throw notFound();
    throw err;
  }
}

export async function listSubjects(programId?: number) {
  return prisma.subject.findMany({
    where: programId === undefined ? undefined : { programId },
    orderBy: [{ programId: 'asc' }, { code: 'asc' }],
    include: { program: { select: { id: true, name: true, status: true } } },
  });
}

export async function createSubject(input: { programId: number; code: string; name: string }) {
  const program = await prisma.program.findUnique({ where: { id: input.programId } });
  if (!program) throw new AppError(400, 'PROGRAM_NOT_FOUND', 'La carrera no existe');
  if (program.status !== ProgramStatus.ACTIVE) {
    throw new AppError(409, 'PROGRAM_INACTIVE', 'No se puede crear una materia en una carrera inactiva');
  }
  try {
    return await prisma.subject.create({ data: input });
  } catch (err) {
    uniqueConflict(err, 'SUBJECT_CODE_TAKEN', 'Ya existe una materia con ese código en la carrera');
  }
}

export async function setSubjectStatus(id: number, status: SubjectStatus) {
  try {
    return await prisma.subject.update({ where: { id }, data: { status } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') throw notFound();
    throw err;
  }
}

export async function listTerms() {
  return prisma.academicTerm.findMany({ orderBy: [{ year: 'desc' }, { term: 'desc' }] });
}

export async function createTerm(input: { year: number; term: number }) {
  try {
    return await prisma.academicTerm.create({ data: input });
  } catch (err) {
    uniqueConflict(err, 'TERM_TAKEN', 'Ese año ya tiene ese cuatrimestre');
  }
}

const sectionInclude = {
  subject: { select: { id: true, code: true, name: true, programId: true, status: true } },
  term: true,
  teachingAssignments: {
    include: { user: { select: { id: true, loginId: true, firstName: true, lastName: true } } },
  },
} satisfies Prisma.SectionInclude;

export async function listSections() {
  return prisma.section.findMany({
    orderBy: { id: 'desc' },
    include: sectionInclude,
  });
}

export interface OpenSectionInput {
  subjectId: number;
  termId: number;
  name: string;
  teachers: { userId: number; position: TeachingPosition }[];
}

export async function openSection(input: OpenSectionInput) {
  const leads = input.teachers.filter((teacher) => teacher.position === TeachingPosition.LEAD);
  if (leads.length < 1) {
    throw new AppError(400, 'LEAD_REQUIRED', 'La comisión tiene que tener al menos un titular');
  }
  const teacherIds = input.teachers.map((teacher) => teacher.userId);
  if (new Set(teacherIds).size !== teacherIds.length) {
    throw new AppError(400, 'TEACHER_DUPLICATED', 'Un docente no se asigna dos veces a la misma comisión');
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const subject = await tx.subject.findUnique({
        where: { id: input.subjectId },
        include: { program: true },
      });
      if (!subject) throw new AppError(400, 'SUBJECT_NOT_FOUND', 'La materia no existe');
      if (subject.status !== SubjectStatus.ACTIVE || subject.program.status !== ProgramStatus.ACTIVE) {
        throw new AppError(
          409,
          'SUBJECT_NOT_OFFERED',
          'Una carrera o una materia inactiva no se ofrece para comisiones nuevas',
        );
      }
      const term = await tx.academicTerm.findUnique({ where: { id: input.termId } });
      if (!term) throw new AppError(400, 'TERM_NOT_FOUND', 'El período lectivo no existe');

      const teachers = await tx.user.findMany({ where: { id: { in: teacherIds } } });
      if (teachers.length !== teacherIds.length) {
        throw new AppError(400, 'TEACHER_NOT_FOUND', 'Uno de los docentes no existe');
      }
      for (const teacher of teachers) {
        if (teacher.role !== RoleName.TEACHER || teacher.status !== UserStatus.ACTIVE) {
          throw new AppError(409, 'TEACHER_NOT_ACTIVE', 'Solo se asigna a un docente activo');
        }
      }

      const section = await tx.section.create({
        data: {
          subjectId: subject.id,
          termId: term.id,
          name: input.name,
          status: SectionStatus.OPEN,
          classroom: { create: {} },
          teachingAssignments: {
            create: input.teachers.map((teacher) => ({
              userId: teacher.userId,
              position: teacher.position,
            })),
          },
        },
        include: sectionInclude,
      });
      return section;
    });
  } catch (err) {
    uniqueConflict(err, 'SECTION_NAME_TAKEN', 'Ya existe una comisión con ese nombre en la materia y el período');
  }
}

export async function closeSection(id: number) {
  const section = await prisma.section.findUnique({ where: { id } });
  if (!section) throw notFound();
  if (section.status === SectionStatus.CLOSED) {
    throw new AppError(409, 'SECTION_ALREADY_CLOSED', 'La comisión ya está cerrada y no se reabre');
  }
  return prisma.section.update({
    where: { id },
    data: { status: SectionStatus.CLOSED },
    include: sectionInclude,
  });
}

export async function getSettings() {
  const settings = await prisma.settings.findUnique({
    where: { id: 1 },
    include: { currentTerm: true },
  });
  if (!settings) throw new AppError(500, 'INTERNAL_ERROR', 'Falta la configuración');
  return settings;
}

const KNOWN_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'image/jpeg',
  'image/png',
] as const;

export const MAX_CONFIGURABLE_FILE_BYTES = 50 * 1024 * 1024;

export async function updateSettings(input: {
  currentTermId: number | null;
  maxFileSizeBytes: number;
  allowedMimeTypes: string[];
}) {
  if (input.currentTermId !== null) {
    const term = await prisma.academicTerm.findUnique({ where: { id: input.currentTermId } });
    if (!term) throw new AppError(400, 'TERM_NOT_FOUND', 'El período lectivo no existe');
  }
  const uniqueTypes = [...new Set(input.allowedMimeTypes)];
  if (uniqueTypes.length === 0) {
    throw new AppError(400, 'MIME_TYPES_REQUIRED', 'Tiene que haber al menos un tipo de archivo');
  }
  if (uniqueTypes.some((type) => !KNOWN_MIME_TYPES.includes(type as (typeof KNOWN_MIME_TYPES)[number]))) {
    throw new AppError(400, 'MIME_TYPE_UNKNOWN', 'Hay un tipo de archivo que el sistema no puede validar');
  }
  if (input.maxFileSizeBytes < 1 || input.maxFileSizeBytes > MAX_CONFIGURABLE_FILE_BYTES) {
    throw new AppError(400, 'FILE_SIZE_OUT_OF_RANGE', 'El tamaño máximo tiene que estar entre 1 byte y 50 MB');
  }
  return prisma.settings.update({
    where: { id: 1 },
    data: {
      currentTermId: input.currentTermId,
      maxFileSizeBytes: input.maxFileSizeBytes,
      allowedMimeTypes: uniqueTypes,
    },
    include: { currentTerm: true },
  });
}

export async function listTeachingSections(teacherId: number) {
  return prisma.section.findMany({
    where: { teachingAssignments: { some: { userId: teacherId } } },
    orderBy: { id: 'desc' },
    include: sectionInclude,
  });
}

export { KNOWN_MIME_TYPES };
