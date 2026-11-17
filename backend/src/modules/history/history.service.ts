import { RoleName } from '@prisma/client';
import type { AuthUser } from '../../shared/auth/index.js';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/errors/index.js';
import { attendanceOf } from '../grading/grading.service.js';

/** Historial académico del alumno. La pantalla y la exportación usan esta función. */
export async function getAcademicHistory(actor: AuthUser, studentId = actor.id) {
  if (actor.role !== RoleName.STUDENT || actor.id !== studentId) {
    throw new AppError(404, 'NOT_FOUND', 'El recurso solicitado no existe');
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: studentId },
    orderBy: { enrolledAt: 'desc' },
    include: {
      section: {
        include: {
          subject: true,
          term: true,
          classroom: { include: { activities: { include: { grades: { where: { userId: studentId } } } } } },
        },
      },
    },
  });
  const records = await prisma.attendanceRecord.findMany({
    where: { userId: studentId },
    select: { value: true, classSession: { select: { sectionId: true } } },
  });

  return enrollments.map((enrollment) => {
    const ownRecords = records.filter((record) => record.classSession.sectionId === enrollment.sectionId);
    const passing = enrollment.section.passingGrade;
    return {
      enrollmentId: enrollment.id,
      status: enrollment.status,
      section: {
        id: enrollment.section.id,
        name: enrollment.section.name,
        status: enrollment.section.status,
        passingGrade: passing,
      },
      subject: { code: enrollment.section.subject.code, name: enrollment.section.subject.name },
      term: { year: enrollment.section.term.year, term: enrollment.section.term.term },
      attendance: attendanceOf(ownRecords),
      grades: (enrollment.section.classroom?.activities ?? []).flatMap((activity) =>
        activity.grades.map((grade) => ({
          activityId: activity.id,
          title: activity.title,
          type: activity.type,
          value: grade.value,
          observation: grade.observation,
          withoutSubmission: grade.withoutSubmission,
          approved: passing === null ? null : grade.value >= passing,
        })),
      ),
    };
  });
}
