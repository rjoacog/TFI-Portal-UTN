import { AuditObject, EnrollmentStatus, Prisma, RoleName, SectionStatus, UserStatus } from '@prisma/client';
import { writeAudit } from '../../shared/audit/index.js';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/errors/index.js';
import { emit } from '../../shared/events/index.js';
import { clock } from '../../shared/dates/index.js';
import type { AuthUser } from '../../shared/auth/index.js';

const notFound = () => new AppError(404, 'NOT_FOUND', 'El recurso solicitado no existe');

async function personIsTeacherOfSection(
  tx: Prisma.TransactionClient,
  dni: string,
  sectionId: number,
) {
  const teachers = await tx.user.findMany({
    where: { dni, role: RoleName.TEACHER },
    select: { id: true },
  });
  if (teachers.length === 0) return false;
  const assigned = await tx.teachingAssignment.findFirst({
    where: { sectionId, userId: { in: teachers.map((teacher) => teacher.id) } },
    select: { id: true },
  });
  return assigned !== null;
}

function changed(enrollmentId: number, studentId: number, status: EnrollmentStatus) {
  emit({ name: 'enrollment.changed', enrollmentId, studentId, status });
}

export function enrollSelf(studentId: number, sectionId: number) {
  return enrollInSection(studentId, studentId, sectionId);
}

async function enrollInSection(actorId: number, studentId: number, sectionId: number) {
  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
    const student = await tx.user.findUnique({ where: { id: studentId } });
    if (!student || student.role !== RoleName.STUDENT || student.status !== UserStatus.ACTIVE) {
      throw new AppError(403, 'FORBIDDEN', 'Solo un alumno activo puede inscribirse');
    }
    const section = await tx.section.findUnique({
      where: { id: sectionId },
      include: { subject: true },
    });
    if (!section) throw notFound();
    if (section.status !== SectionStatus.OPEN) {
      throw new AppError(409, 'SECTION_CLOSED', 'La comisión está cerrada');
    }
    const settings = await tx.settings.findUniqueOrThrow({ where: { id: 1 } });
    if (settings.currentTermId === null || section.termId !== settings.currentTermId) {
      throw new AppError(409, 'TERM_NOT_CURRENT', 'La comisión no es del período vigente');
    }
    const career = await tx.studentProgram.findUnique({
      where: { userId_programId: { userId: studentId, programId: section.subject.programId } },
    });
    if (!career) throw notFound();
    const otherActive = await tx.enrollment.findFirst({
      where: {
        userId: studentId,
        subjectId: section.subjectId,
        termId: section.termId,
        status: EnrollmentStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (otherActive) {
      throw new AppError(
        409,
        'ACTIVE_ENROLLMENT_EXISTS',
        'El alumno ya tiene una inscripción activa en esa materia y ese período',
      );
    }
    const existing = await tx.enrollment.findUnique({
      where: { userId_sectionId: { userId: studentId, sectionId } },
    });
    if (existing) {
      throw new AppError(409, 'ALREADY_ENROLLED', 'Ya hay una inscripción en esa comisión');
    }
    if (await personIsTeacherOfSection(tx, student.dni, sectionId)) {
      throw new AppError(
        409,
        'TEACHER_AND_STUDENT',
        'No se puede ser docente y alumno de la misma comisión',
      );
    }

    const now = clock.now();
    const enrollment = await tx.enrollment.create({
      data: {
        userId: studentId,
        sectionId,
        subjectId: section.subjectId,
        termId: section.termId,
        status: EnrollmentStatus.ACTIVE,
        enrolledAt: now,
        changes: { create: { status: EnrollmentStatus.ACTIVE, changedAt: now, actorId } },
      },
    });
    await writeAudit(tx, {
      actorId,
      objectType: AuditObject.ENROLLMENT,
      objectId: enrollment.id,
      field: 'status',
      previousValue: null,
      newValue: EnrollmentStatus.ACTIVE,
    });
    return enrollment;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(
        409,
        'ACTIVE_ENROLLMENT_EXISTS',
        'El alumno ya tiene una inscripción activa en esa materia y ese período',
      );
    }
    throw err;
  }
  changed(result.id, result.userId, EnrollmentStatus.ACTIVE);
  return result;
}

async function changeStatus(actor: AuthUser, enrollmentId: number, next: EnrollmentStatus) {
  try {
    const result = await prisma.$transaction(async (tx) => {
    const enrollment = await tx.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { section: true, user: true },
    });
    if (!enrollment) throw notFound();

    const isAdmin = actor.role === RoleName.ADMIN;
    const isOwner = actor.role === RoleName.STUDENT && actor.id === enrollment.userId;
    if (next === EnrollmentStatus.DROPPED && !isAdmin && !isOwner) throw notFound();
    if (next === EnrollmentStatus.ACTIVE && !isAdmin) throw notFound();
    if (enrollment.status === next) {
      throw new AppError(409, 'ENROLLMENT_UNCHANGED', 'La inscripción ya está en ese estado');
    }
    if (enrollment.status === EnrollmentStatus.DROPPED && !isAdmin) throw notFound();

    if (next === EnrollmentStatus.ACTIVE) {
      if (enrollment.section.status !== SectionStatus.OPEN) {
        throw new AppError(409, 'SECTION_CLOSED', 'La comisión está cerrada');
      }
    }

    const now = clock.now();
    const updated = await tx.enrollment.update({
      where: { id: enrollmentId },
      data: {
        status: next,
        changes: { create: { status: next, changedAt: now, actorId: actor.id } },
      },
    });
    await writeAudit(tx, {
      actorId: actor.id,
      objectType: AuditObject.ENROLLMENT,
      objectId: enrollmentId,
      field: 'status',
      previousValue: enrollment.status,
      newValue: next,
    });
    return updated;
  });
    changed(result.id, result.userId, result.status);
    return result;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(
        409,
        'ACTIVE_ENROLLMENT_EXISTS',
        'El alumno ya tiene una inscripción activa en esa materia y ese período',
      );
    }
    throw err;
  }
}

export function dropEnrollment(actor: AuthUser, enrollmentId: number) {
  return changeStatus(actor, enrollmentId, EnrollmentStatus.DROPPED);
}

export function reactivateEnrollment(actor: AuthUser, enrollmentId: number) {
  return changeStatus(actor, enrollmentId, EnrollmentStatus.ACTIVE);
}

export async function listSectionEnrollments(sectionId: number) {
  return prisma.enrollment.findMany({
    where: { sectionId },
    orderBy: { user: { lastName: 'asc' } },
    include: {
      user: { select: { id: true, loginId: true, firstName: true, lastName: true, dni: true } },
    },
  });
}

export async function listOffer(studentId: number) {
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: 1 } });
  if (settings.currentTermId === null) return [];
  const careers = await prisma.studentProgram.findMany({
    where: { userId: studentId },
    select: { programId: true },
  });
  const sections = await prisma.section.findMany({
    where: {
      status: SectionStatus.OPEN,
      termId: settings.currentTermId,
      subject: { programId: { in: careers.map((career) => career.programId) } },
    },
    orderBy: [{ subject: { code: 'asc' } }, { name: 'asc' }],
    include: {
      subject: { select: { code: true, name: true } },
      term: true,
      enrollments: { where: { userId: studentId }, select: { id: true, status: true } },
    },
  });
  return sections.map((section) => ({
    id: section.id,
    name: section.name,
    subject: section.subject,
    term: section.term,
    enrollment: section.enrollments[0] ?? null,
  }));
}
