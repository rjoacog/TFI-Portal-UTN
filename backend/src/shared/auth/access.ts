import { EnrollmentStatus, RoleName, SectionStatus, type Prisma } from '@prisma/client';
import { AppError } from '../errors/index.js';
import { prisma } from '../db/index.js';
import type { AuthUser } from './middleware.js';

const notFound = () => new AppError(404, 'NOT_FOUND', 'El recurso solicitado no existe');

export function sectionClosed() {
  return new AppError(409, 'SECTION_CLOSED', 'La comisión está cerrada');
}

export interface SectionAccess {
  section: {
    id: number;
    subjectId: number;
    termId: number;
    name: string;
    status: SectionStatus;
    passingGrade: number | null;
  };
  classroomId: number;
  teaches: boolean;
  enrollmentStatus: EnrollmentStatus | null;
}

const sectionSelect = {
  id: true,
  subjectId: true,
  termId: true,
  name: true,
  status: true,
  passingGrade: true,
  classroom: { select: { id: true } },
} satisfies Prisma.SectionSelect;

export async function loadSectionAccess(user: AuthUser, sectionId: number): Promise<SectionAccess> {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    select: sectionSelect,
  });
  if (!section?.classroom) throw notFound();

  const [assignment, enrollment] = await Promise.all([
    user.role === RoleName.TEACHER
      ? prisma.teachingAssignment.findUnique({
          where: { userId_sectionId: { userId: user.id, sectionId } },
          select: { id: true },
        })
      : Promise.resolve(null),
    user.role === RoleName.STUDENT
      ? prisma.enrollment.findUnique({
          where: { userId_sectionId: { userId: user.id, sectionId } },
          select: { status: true },
        })
      : Promise.resolve(null),
  ]);

  const teaches = assignment !== null;
  const enrollmentStatus = enrollment?.status ?? null;
  const isAdmin = user.role === RoleName.ADMIN;
  if (!isAdmin && !teaches && !enrollmentStatus) throw notFound();

  return {
    section: {
      id: section.id,
      subjectId: section.subjectId,
      termId: section.termId,
      name: section.name,
      status: section.status,
      passingGrade: section.passingGrade,
    },
    classroomId: section.classroom.id,
    teaches,
    enrollmentStatus,
  };
}

/** Docente asignado a la comisión. Si no lo está, 404. */
export async function assertTeacher(user: AuthUser, sectionId: number) {
  const access = await loadSectionAccess(user, sectionId);
  if (!access.teaches) throw notFound();
  return access;
}

/** Docente asignado y comisión abierta. */
export async function assertTeacherOfOpenSection(user: AuthUser, sectionId: number) {
  const access = await assertTeacher(user, sectionId);
  if (access.section.status !== SectionStatus.OPEN) throw sectionClosed();
  return access;
}

/**
 * Alumno con inscripción activa. Pregunta por ACTIVE, nunca por "no está de baja".
 */
export async function assertActiveStudent(user: AuthUser, sectionId: number) {
  const access = await loadSectionAccess(user, sectionId);
  if (access.enrollmentStatus !== EnrollmentStatus.ACTIVE) throw notFound();
  return access;
}

export function assertSectionOpen(access: SectionAccess) {
  if (access.section.status !== SectionStatus.OPEN) throw sectionClosed();
}
