import { AttendanceValue, AuditObject, EnrollmentStatus } from '@prisma/client';
import { writeAudit } from '../../shared/audit/index.js';
import { assertTeacher, assertTeacherOfOpenSection, loadSectionAccess, type AuthUser } from '../../shared/auth/index.js';
import { endOfArgentinaDay, isFutureDate } from '../../shared/dates/index.js';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/errors/index.js';

const notFound = () => new AppError(404, 'NOT_FOUND', 'El recurso solicitado no existe');

function wasActive(
  changes: { status: EnrollmentStatus; changedAt: Date; id: number }[],
  end: Date,
) {
  const prior = changes
    .filter((change) => change.changedAt.getTime() <= end.getTime())
    .sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime() || a.id - b.id);
  return prior.at(-1)?.status === EnrollmentStatus.ACTIVE;
}

export async function registerClass(user: AuthUser, sectionId: number, date: string) {
  await assertTeacherOfOpenSection(user, sectionId);
  if (isFutureDate(date)) {
    throw new AppError(400, 'FUTURE_CLASS_DATE', 'La fecha de la clase no puede ser futura');
  }
  const end = endOfArgentinaDay(date);
  const enrollments = await prisma.enrollment.findMany({
    where: { sectionId },
    include: { changes: true },
  });
  const present = enrollments.filter((enrollment) => wasActive(enrollment.changes, end));

  try {
    return await prisma.classSession.create({
      data: {
        sectionId,
        date: new Date(`${date}T00:00:00.000Z`),
        recordedById: user.id,
        records: {
          create: present.map((enrollment) => ({
            userId: enrollment.userId,
            enrollmentId: enrollment.id,
            value: AttendanceValue.PRESENT,
          })),
        },
      },
      include: {
        records: { include: { user: { select: { id: true, loginId: true, firstName: true, lastName: true } } } },
      },
    });
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
      throw new AppError(409, 'CLASS_ALREADY_EXISTS', 'Ya hay una clase de esa comisión en esa fecha');
    }
    throw err;
  }
}

export async function correctClass(
  user: AuthUser,
  classSessionId: number,
  updates: { userId: number; value: AttendanceValue }[],
) {
  const session = await prisma.classSession.findUnique({
    where: { id: classSessionId },
    include: { records: true },
  });
  if (!session) throw notFound();
  await assertTeacher(user, session.sectionId);

  return prisma.$transaction(async (tx) => {
    for (const update of updates) {
      const record = session.records.find((item) => item.userId === update.userId);
      if (!record) throw notFound();
      if (record.value === update.value) continue;
      await tx.attendanceRecord.update({ where: { id: record.id }, data: { value: update.value } });
      await writeAudit(tx, {
        actorId: user.id,
        objectType: AuditObject.ATTENDANCE,
        objectId: record.id,
        field: 'value',
        previousValue: record.value,
        newValue: update.value,
      });
    }
    return tx.classSession.findUniqueOrThrow({
      where: { id: classSessionId },
      include: {
        records: { include: { user: { select: { id: true, loginId: true, firstName: true, lastName: true } } } },
      },
    });
  });
}

export async function listClasses(user: AuthUser, sectionId: number) {
  const access = await loadSectionAccess(user, sectionId);
  if (!access.teaches && user.role !== 'ADMIN') throw notFound();
  return prisma.classSession.findMany({
    where: { sectionId },
    orderBy: { date: 'desc' },
    include: {
      records: { include: { user: { select: { id: true, loginId: true, firstName: true, lastName: true } } } },
    },
  });
}
