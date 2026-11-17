import {
  ActivityStatus,
  ActivityType,
  ContentStatus,
  EnrollmentStatus,
  Prisma,
  SubmissionStatus,
  Timeliness,
} from '@prisma/client';
import { assertActiveStudent, assertSectionOpen, assertTeacherOfOpenSection, loadSectionAccess, type AuthUser } from '../../shared/auth/index.js';
import { clock, parseArgentinaDateTime } from '../../shared/dates/index.js';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/errors/index.js';
import { emit } from '../../shared/events/index.js';
import { assertAllowedFile, detectMimeType, type FileStorage } from '../../shared/storage/index.js';
import type { IncomingFile } from '../../shared/storage/upload.js';

const notFound = () => new AppError(404, 'NOT_FOUND', 'El recurso solicitado no existe');

async function settingsOf() {
  return prisma.settings.findUniqueOrThrow({ where: { id: 1 } });
}

async function storeFiles(
  storage: FileStorage,
  files: IncomingFile[],
  uploadedById: number,
  owner: { materialId?: number; activityId?: number; submissionId?: number },
) {
  const settings = await settingsOf();
  const prepared: { file: IncomingFile; mimeType: string; storageKey: string }[] = [];
  try {
    for (const file of files) {
      const mimeType = await detectMimeType(file.buffer);
      assertAllowedFile(file.buffer, mimeType, settings);
      const stored = await storage.save(file.buffer);
      prepared.push({ file, mimeType: mimeType!, storageKey: stored.storageKey });
    }
    if (prepared.length === 0) return;
    await prisma.attachment.createMany({
      data: prepared.map((item) => ({
        ...owner,
        fileName: item.file.originalname.slice(0, 200),
        mimeType: item.mimeType,
        sizeBytes: item.file.size,
        uploadedById,
        storageKey: item.storageKey,
      })),
    });
  } catch (err) {
    await Promise.all(prepared.map((item) => storage.remove(item.storageKey)));
    throw err;
  }
}

export async function getClassroom(user: AuthUser, sectionId: number) {
  const access = await loadSectionAccess(user, sectionId);
  const [materials, announcements, activities] = await Promise.all([
    prisma.material.findMany({
      where: { classroomId: access.classroomId, status: ContentStatus.PUBLISHED },
      orderBy: { publishedAt: 'desc' },
      include: { attachments: { select: { id: true, fileName: true, sizeBytes: true } } },
    }),
    prisma.announcement.findMany({
      where: { classroomId: access.classroomId, status: ContentStatus.PUBLISHED },
      orderBy: { publishedAt: 'desc' },
    }),
    prisma.activity.findMany({
      where: { classroomId: access.classroomId },
      orderBy: { id: 'asc' },
      include: {
        attachments: { select: { id: true, fileName: true, sizeBytes: true } },
        submissions: user.role === 'STUDENT' ? { where: { userId: user.id } } : { where: { userId: -1 } },
        grades: user.role === 'STUDENT' ? { where: { userId: user.id } } : { where: { userId: -1 } },
      },
    }),
  ]);

  return {
    section: access.section,
    canManage: access.teaches && access.section.status === 'OPEN',
    canSubmit: access.enrollmentStatus === EnrollmentStatus.ACTIVE && access.section.status === 'OPEN',
    canGrade: access.teaches,
    materials,
    announcements,
    activities: activities.map((activity) => ({
      ...activity,
      mySubmission: activity.submissions[0] ?? null,
      myGrade: activity.grades[0]
        ? {
            ...activity.grades[0],
            approved:
              access.section.passingGrade === null
                ? null
                : activity.grades[0].value >= access.section.passingGrade,
          }
        : null,
      submissions: undefined,
      grades: undefined,
    })),
  };
}

export async function createMaterial(
  user: AuthUser,
  sectionId: number,
  input: { title: string; description: string },
  files: IncomingFile[],
  storage: FileStorage,
) {
  const access = await assertTeacherOfOpenSection(user, sectionId);
  const material = await prisma.material.create({
    data: {
      classroomId: access.classroomId,
      authorId: user.id,
      title: input.title,
      description: input.description,
      publishedAt: clock.now(),
    },
  });
  try {
    await storeFiles(storage, files, user.id, { materialId: material.id });
  } catch (err) {
    await prisma.attachment.deleteMany({ where: { materialId: material.id } });
    await prisma.material.delete({ where: { id: material.id } });
    throw err;
  }
  return prisma.material.findUniqueOrThrow({
    where: { id: material.id },
    include: { attachments: true },
  });
}

export async function updateMaterial(
  user: AuthUser,
  sectionId: number,
  materialId: number,
  input: { title: string; description: string },
) {
  const access = await assertTeacherOfOpenSection(user, sectionId);
  const material = await prisma.material.findFirst({
    where: { id: materialId, classroomId: access.classroomId, status: ContentStatus.PUBLISHED },
  });
  if (!material) throw notFound();
  return prisma.material.update({
    where: { id: materialId },
    data: input,
    include: { attachments: true },
  });
}

export async function addMaterialFiles(
  user: AuthUser,
  sectionId: number,
  materialId: number,
  files: IncomingFile[],
  storage: FileStorage,
) {
  const access = await assertTeacherOfOpenSection(user, sectionId);
  const material = await prisma.material.findFirst({
    where: { id: materialId, classroomId: access.classroomId, status: ContentStatus.PUBLISHED },
  });
  if (!material) throw notFound();
  await storeFiles(storage, files, user.id, { materialId });
  return prisma.material.findUniqueOrThrow({ where: { id: materialId }, include: { attachments: true } });
}

export async function withdrawMaterial(user: AuthUser, sectionId: number, materialId: number) {
  const access = await assertTeacherOfOpenSection(user, sectionId);
  const material = await prisma.material.findFirst({
    where: { id: materialId, classroomId: access.classroomId, status: ContentStatus.PUBLISHED },
  });
  if (!material) throw notFound();
  return prisma.material.update({
    where: { id: materialId },
    data: { status: ContentStatus.WITHDRAWN },
  });
}

export async function createAnnouncement(
  user: AuthUser,
  sectionId: number,
  input: { title: string; body: string },
) {
  const access = await assertTeacherOfOpenSection(user, sectionId);
  const announcement = await prisma.announcement.create({
    data: {
      classroomId: access.classroomId,
      authorId: user.id,
      title: input.title,
      body: input.body,
      publishedAt: clock.now(),
    },
  });
  emit({ name: 'announcement.published', announcementId: announcement.id, sectionId });
  return announcement;
}

export async function updateAnnouncement(
  user: AuthUser,
  sectionId: number,
  announcementId: number,
  input: { title: string; body: string },
) {
  const access = await assertTeacherOfOpenSection(user, sectionId);
  const announcement = await prisma.announcement.findFirst({
    where: { id: announcementId, classroomId: access.classroomId, status: ContentStatus.PUBLISHED },
  });
  if (!announcement) throw notFound();
  return prisma.announcement.update({ where: { id: announcementId }, data: input });
}

export async function withdrawAnnouncement(user: AuthUser, sectionId: number, announcementId: number) {
  const access = await assertTeacherOfOpenSection(user, sectionId);
  const announcement = await prisma.announcement.findFirst({
    where: { id: announcementId, classroomId: access.classroomId, status: ContentStatus.PUBLISHED },
  });
  if (!announcement) throw notFound();
  return prisma.announcement.update({
    where: { id: announcementId },
    data: { status: ContentStatus.WITHDRAWN },
  });
}

export async function createActivity(
  user: AuthUser,
  sectionId: number,
  input: { type: ActivityType; title: string; description: string; dueAt?: string },
  files: IncomingFile[],
  storage: FileStorage,
) {
  const access = await assertTeacherOfOpenSection(user, sectionId);
  const dueAt = input.type === ActivityType.ASSIGNMENT ? parseArgentinaDateTime(input.dueAt ?? '') : null;
  if (input.type === ActivityType.ASSIGNMENT && (dueAt === null || dueAt.getTime() <= clock.now().getTime())) {
    throw new AppError(400, 'DUE_DATE_NOT_FUTURE', 'La fecha límite tiene que ser futura');
  }
  const activity = await prisma.activity.create({
    data: {
      classroomId: access.classroomId,
      authorId: user.id,
      type: input.type,
      title: input.title,
      description: input.description,
      dueAt,
    },
  });
  try {
    await storeFiles(storage, files, user.id, { activityId: activity.id });
  } catch (err) {
    await prisma.attachment.deleteMany({ where: { activityId: activity.id } });
    await prisma.activity.delete({ where: { id: activity.id } });
    throw err;
  }
  return prisma.activity.findUniqueOrThrow({ where: { id: activity.id }, include: { attachments: true } });
}

export async function updateActivity(
  user: AuthUser,
  sectionId: number,
  activityId: number,
  input: { title: string; description: string; dueAt?: string },
) {
  const access = await assertTeacherOfOpenSection(user, sectionId);
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, classroomId: access.classroomId },
  });
  if (!activity) throw notFound();
  const data: Prisma.ActivityUpdateInput = { title: input.title, description: input.description };
  if (activity.type === ActivityType.ASSIGNMENT && input.dueAt) {
    data.dueAt = parseArgentinaDateTime(input.dueAt);
  }
  return prisma.activity.update({ where: { id: activityId }, data, include: { attachments: true } });
}

export async function addActivityFiles(
  user: AuthUser,
  sectionId: number,
  activityId: number,
  files: IncomingFile[],
  storage: FileStorage,
) {
  const access = await assertTeacherOfOpenSection(user, sectionId);
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, classroomId: access.classroomId, status: ActivityStatus.PUBLISHED },
  });
  if (!activity) throw notFound();
  await storeFiles(storage, files, user.id, { activityId });
  return prisma.activity.findUniqueOrThrow({ where: { id: activityId }, include: { attachments: true } });
}

export async function closeActivity(user: AuthUser, sectionId: number, activityId: number) {
  const access = await assertTeacherOfOpenSection(user, sectionId);
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, classroomId: access.classroomId },
  });
  if (!activity) throw notFound();
  if (activity.status === ActivityStatus.CLOSED) {
    throw new AppError(409, 'ACTIVITY_ALREADY_CLOSED', 'La actividad ya está cerrada y no se reabre');
  }
  return prisma.activity.update({
    where: { id: activityId },
    data: { status: ActivityStatus.CLOSED },
  });
}

export async function submitWork(
  user: AuthUser,
  activityId: number,
  file: IncomingFile,
  storage: FileStorage,
) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: { classroom: true },
  });
  if (!activity || activity.type !== ActivityType.ASSIGNMENT || !activity.dueAt) throw notFound();
  const access = await assertActiveStudent(user, activity.classroom.sectionId);
  assertSectionOpen(access);
  if (activity.status !== ActivityStatus.PUBLISHED) {
    throw new AppError(409, 'ACTIVITY_CLOSED', 'La actividad está cerrada y no recibe archivos');
  }
  const existing = await prisma.submission.findUnique({
    where: { activityId_userId: { activityId, userId: user.id } },
    include: { attachment: true },
  });
  if (existing?.status === SubmissionStatus.GRADED) {
    throw new AppError(409, 'SUBMISSION_GRADED', 'El trabajo ya está calificado y no se puede reemplazar');
  }
  const grade = await prisma.grade.findUnique({
    where: { activityId_userId: { activityId, userId: user.id } },
  });
  if (grade) {
    throw new AppError(409, 'SUBMISSION_GRADED', 'El trabajo ya está calificado y no se puede reemplazar');
  }

  const settings = await settingsOf();
  const mimeType = await detectMimeType(file.buffer);
  assertAllowedFile(file.buffer, mimeType, settings);
  const stored = await storage.save(file.buffer);
  const submittedAt = clock.now();
  const timeliness = submittedAt.getTime() <= activity.dueAt.getTime() ? Timeliness.ON_TIME : Timeliness.LATE;
  const previousKey = existing?.attachment?.storageKey;

  try {
    const submission = await prisma.$transaction(async (tx) => {
      const row = existing
        ? await tx.submission.update({
            where: { id: existing.id },
            data: { submittedAt, timeliness, status: SubmissionStatus.SUBMITTED },
          })
        : await tx.submission.create({
            data: { activityId, userId: user.id, submittedAt, timeliness },
          });
      if (existing?.attachment) {
        await tx.attachment.delete({ where: { id: existing.attachment.id } });
      }
      await tx.attachment.create({
        data: {
          submissionId: row.id,
          fileName: file.originalname.slice(0, 200),
          mimeType: mimeType!,
          sizeBytes: file.size,
          uploadedById: user.id,
          storageKey: stored.storageKey,
        },
      });
      return row;
    });
    if (previousKey) await storage.remove(previousKey);
    return prisma.submission.findUniqueOrThrow({
      where: { id: submission.id },
      include: { attachment: true },
    });
  } catch (err) {
    await storage.remove(stored.storageKey);
    throw err;
  }
}

export async function removeAttachment(user: AuthUser, attachmentId: number, storage: FileStorage) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: {
      material: { include: { classroom: true } },
      activity: { include: { classroom: true } },
    },
  });
  if (!attachment || attachment.submissionId) throw notFound();
  const sectionId = attachment.material?.classroom.sectionId ?? attachment.activity?.classroom.sectionId;
  if (!sectionId) throw notFound();
  if (attachment.material?.status === ContentStatus.WITHDRAWN) throw notFound();
  if (attachment.activity?.status === ActivityStatus.CLOSED) {
    throw new AppError(409, 'ACTIVITY_CLOSED', 'La actividad está cerrada y no recibe archivos');
  }
  await assertTeacherOfOpenSection(user, sectionId);
  await prisma.attachment.delete({ where: { id: attachmentId } });
  await storage.remove(attachment.storageKey);
}

export async function openAttachment(user: AuthUser, attachmentId: number, storage: FileStorage) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: {
      material: { include: { classroom: true } },
      activity: { include: { classroom: true } },
      submission: { include: { activity: { include: { classroom: true } } } },
    },
  });
  if (!attachment) throw notFound();
  if (attachment.material?.status === ContentStatus.WITHDRAWN) throw notFound();

  const sectionId =
    attachment.material?.classroom.sectionId ??
    attachment.activity?.classroom.sectionId ??
    attachment.submission?.activity.classroom.sectionId;
  if (!sectionId) throw notFound();
  const access = await loadSectionAccess(user, sectionId);

  if (attachment.submission && !access.teaches && user.role !== 'ADMIN' && attachment.submission.userId !== user.id) {
    throw notFound();
  }
  const stream = storage.stream(attachment.storageKey);
  return { attachment, stream };
}
