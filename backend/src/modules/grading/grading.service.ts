import { AuditObject, EnrollmentStatus, SubmissionStatus } from '@prisma/client';
import { writeAudit } from '../../shared/audit/index.js';
import { assertTeacher, loadSectionAccess, type AuthUser } from '../../shared/auth/index.js';
import { clock } from '../../shared/dates/index.js';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/errors/index.js';
import { emit } from '../../shared/events/index.js';

const notFound = () => new AppError(404, 'NOT_FOUND', 'El recurso solicitado no existe');

export async function recordGrade(
  user: AuthUser,
  activityId: number,
  input: { userId: number; value: number; observation?: string },
) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { classroom: true },
  });
  if (!activity) throw notFound();
  const sectionId = activity.classroom.sectionId;
  await assertTeacher(user, sectionId);

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_sectionId: { userId: input.userId, sectionId } },
  });
  if (!enrollment) throw notFound();

  const submission = await prisma.submission.findUnique({
    where: { activityId_userId: { activityId, userId: input.userId } },
  });
  if (activity.type === 'ASSESSMENT' && submission) throw notFound();

  const withoutSubmission = submission === null;
  if (withoutSubmission && enrollment.status !== EnrollmentStatus.ACTIVE) {
    throw new AppError(
      409,
      'ENROLLMENT_NOT_ACTIVE',
      'Solo se califica sin entrega a un alumno con inscripción activa',
    );
  }

  const observation = input.observation?.trim() ? input.observation.trim() : null;
  const now = clock.now();

  const grade = await prisma.$transaction(async (tx) => {
    const current = await tx.grade.findUnique({
      where: { activityId_userId: { activityId, userId: input.userId } },
    });
    const saved = current
      ? await tx.grade.update({
          where: { id: current.id },
          data: { value: input.value, observation, teacherId: user.id, gradedAt: now },
        })
      : await tx.grade.create({
          data: {
            activityId,
            userId: input.userId,
            value: input.value,
            observation,
            teacherId: user.id,
            gradedAt: now,
            withoutSubmission,
          },
        });
    if (submission && submission.status !== SubmissionStatus.GRADED) {
      await tx.submission.update({
        where: { id: submission.id },
        data: { status: SubmissionStatus.GRADED },
      });
    }
    if (!current || current.value !== input.value) {
      await writeAudit(tx, {
        actorId: user.id,
        objectType: AuditObject.GRADE,
        objectId: saved.id,
        field: 'value',
        previousValue: current ? String(current.value) : null,
        newValue: String(input.value),
      });
    }
    if (current && current.observation !== observation) {
      await writeAudit(tx, {
        actorId: user.id,
        objectType: AuditObject.GRADE,
        objectId: saved.id,
        field: 'observation',
        previousValue: current.observation,
        newValue: observation,
      });
    }
    return { saved, rectified: current !== null };
  });

  emit({
    name: 'grade.recorded',
    gradeId: grade.saved.id,
    studentId: input.userId,
    sectionId,
    rectified: grade.rectified,
  });
  return grade.saved;
}

export async function setPassingGrade(user: AuthUser, sectionId: number, passingGrade: number) {
  const access = await assertTeacher(user, sectionId);
  if (access.section.status !== 'OPEN') {
    throw new AppError(409, 'SECTION_CLOSED', 'La nota de aprobación se cambia con la comisión abierta');
  }
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.section.findUniqueOrThrow({ where: { id: sectionId } });
    const section = await tx.section.update({
      where: { id: sectionId },
      data: { passingGrade },
    });
    await writeAudit(tx, {
      actorId: user.id,
      objectType: AuditObject.PASSING_GRADE,
      objectId: sectionId,
      field: 'passingGrade',
      previousValue: current.passingGrade === null ? null : String(current.passingGrade),
      newValue: String(passingGrade),
    });
    return section;
  });
  return updated;
}

export interface SheetCell {
  activityId: number;
  submission: 'NONE' | 'ON_TIME' | 'LATE' | 'GRADED';
  grade: number | null;
  observation: string | null;
  withoutSubmission: boolean;
  approved: boolean | null;
}

export interface SheetRow {
  userId: number;
  loginId: string;
  firstName: string;
  lastName: string;
  enrollmentStatus: EnrollmentStatus;
  attendance: { percentage: number | null; label: string };
  cells: SheetCell[];
}

export interface SectionSheet {
  section: { id: number; name: string; passingGrade: number | null; status: string };
  activities: { id: number; title: string; type: string }[];
  rows: SheetRow[];
}

/** Planilla de la comisión. La pantalla y la exportación usan esta función. */
export async function getSectionSheet(user: AuthUser, sectionId: number): Promise<SectionSheet> {
  const access = await loadSectionAccess(user, sectionId);
  if (!access.teaches && user.role !== 'ADMIN') {
    throw new AppError(404, 'NOT_FOUND', 'El recurso solicitado no existe');
  }

  const [activities, enrollments, records] = await Promise.all([
    prisma.activity.findMany({
      where: { classroomId: access.classroomId },
      orderBy: { id: 'asc' },
      include: { submissions: true, grades: true },
    }),
    prisma.enrollment.findMany({
      where: { sectionId },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
      include: { user: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { classSession: { sectionId } },
      select: { userId: true, value: true },
    }),
  ]);

  const attendance = new Map<number, { present: number; total: number }>();
  for (const record of records) {
    const bucket = attendance.get(record.userId) ?? { present: 0, total: 0 };
    bucket.total += 1;
    if (record.value === 'PRESENT') bucket.present += 1;
    attendance.set(record.userId, bucket);
  }

  return {
    section: {
      id: access.section.id,
      name: access.section.name,
      passingGrade: access.section.passingGrade,
      status: access.section.status,
    },
    activities: activities.map((activity) => ({
      id: activity.id,
      title: activity.title,
      type: activity.type,
    })),
    rows: enrollments.map((enrollment) => {
      const bucket = attendance.get(enrollment.userId);
      const percentage = bucket && bucket.total > 0 ? Math.round((bucket.present / bucket.total) * 100) : null;
      return {
        userId: enrollment.userId,
        loginId: enrollment.user.loginId,
        firstName: enrollment.user.firstName,
        lastName: enrollment.user.lastName,
        enrollmentStatus: enrollment.status,
        attendance: {
          percentage,
          label: percentage === null ? 'sin registros' : `${percentage} %`,
        },
        cells: activities.map((activity) => {
          const submission = activity.submissions.find((item) => item.userId === enrollment.userId);
          const grade = activity.grades.find((item) => item.userId === enrollment.userId);
          let state: SheetCell['submission'] = 'NONE';
          if (grade) state = 'GRADED';
          else if (submission?.timeliness === 'LATE') state = 'LATE';
          else if (submission) state = 'ON_TIME';
          return {
            activityId: activity.id,
            submission: activity.type === 'ASSESSMENT' && !grade ? 'NONE' : state,
            grade: grade?.value ?? null,
            observation: grade?.observation ?? null,
            withoutSubmission: grade?.withoutSubmission ?? false,
            approved:
              grade && access.section.passingGrade !== null
                ? grade.value >= access.section.passingGrade
                : null,
          };
        }),
      };
    }),
  };
}

export function attendanceOf(records: { value: string }[]) {
  if (records.length === 0) return { percentage: null, label: 'sin registros' };
  const present = records.filter((record) => record.value === 'PRESENT').length;
  const percentage = Math.round((present / records.length) * 100);
  return { percentage, label: `${percentage} %` };
}
