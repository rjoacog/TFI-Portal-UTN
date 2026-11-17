import { ActivityType } from '@prisma/client';
import { Router } from 'express';
import { createRequireAuth } from '../../shared/auth/index.js';
import { AppError } from '../../shared/errors/index.js';
import type { FileStorage } from '../../shared/storage/index.js';
import { readIncomingFiles, receiveFiles } from '../../shared/storage/upload.js';
import { argentinaDateTimeSchema, longTextSchema, titleSchema } from '../../shared/validation/fields.js';
import { z } from '../../shared/validation/index.js';
import {
  addActivityFiles,
  addMaterialFiles,
  closeActivity,
  createActivity,
  createAnnouncement,
  createMaterial,
  getClassroom,
  openAttachment,
  removeAttachment,
  submitWork,
  updateActivity,
  updateAnnouncement,
  updateMaterial,
  withdrawAnnouncement,
  withdrawMaterial,
} from './classroom.service.js';

const textBody = z.strictObject({ title: titleSchema, description: longTextSchema });
const announcementBody = z.strictObject({ title: titleSchema, body: longTextSchema });
const activityBody = z
  .strictObject({
    type: z.enum(ActivityType),
    title: titleSchema,
    description: longTextSchema,
    dueAt: argentinaDateTimeSchema.optional(),
  })
  .refine((value) => value.type !== ActivityType.ASSIGNMENT || value.dueAt !== undefined, {
    path: ['dueAt'],
    message: 'El trabajo práctico tiene que tener una fecha límite',
  });
const activityUpdate = z.strictObject({
  title: titleSchema,
  description: longTextSchema,
  dueAt: argentinaDateTimeSchema.optional(),
});

export function createClassroomRouter({
  jwtSecret,
  storage,
}: {
  jwtSecret: string;
  storage: FileStorage;
}) {
  const router = Router();
  const requireAuth = createRequireAuth(jwtSecret);
  const id = z.coerce.number().int().positive();

  router.get('/sections/:sectionId/classroom', requireAuth, async (req, res) => {
    const classroom = await getClassroom(req.user!, id.parse(req.params.sectionId));
    res.status(200).json({ classroom });
  });

  router.post(
    '/sections/:sectionId/materials',
    requireAuth,
    receiveFiles('files', 10),
    async (req, res) => {
      const material = await createMaterial(
        req.user!,
        id.parse(req.params.sectionId),
        textBody.parse(req.body),
        readIncomingFiles(req.files as Express.Multer.File[] | undefined),
        storage,
      );
      res.status(201).json({ material });
    },
  );

  router.patch('/sections/:sectionId/materials/:materialId', requireAuth, async (req, res) => {
    const material = await updateMaterial(
      req.user!,
      id.parse(req.params.sectionId),
      id.parse(req.params.materialId),
      textBody.parse(req.body),
    );
    res.status(200).json({ material });
  });

  router.post(
    '/sections/:sectionId/materials/:materialId/files',
    requireAuth,
    receiveFiles('files', 10),
    async (req, res) => {
      const material = await addMaterialFiles(
        req.user!,
        id.parse(req.params.sectionId),
        id.parse(req.params.materialId),
        readIncomingFiles(req.files as Express.Multer.File[] | undefined),
        storage,
      );
      res.status(200).json({ material });
    },
  );

  router.post('/sections/:sectionId/materials/:materialId/withdraw', requireAuth, async (req, res) => {
    const material = await withdrawMaterial(
      req.user!,
      id.parse(req.params.sectionId),
      id.parse(req.params.materialId),
    );
    res.status(200).json({ material });
  });

  router.post('/sections/:sectionId/announcements', requireAuth, async (req, res) => {
    const announcement = await createAnnouncement(
      req.user!,
      id.parse(req.params.sectionId),
      announcementBody.parse(req.body),
    );
    res.status(201).json({ announcement });
  });

  router.patch('/sections/:sectionId/announcements/:announcementId', requireAuth, async (req, res) => {
    const announcement = await updateAnnouncement(
      req.user!,
      id.parse(req.params.sectionId),
      id.parse(req.params.announcementId),
      announcementBody.parse(req.body),
    );
    res.status(200).json({ announcement });
  });

  router.post(
    '/sections/:sectionId/announcements/:announcementId/withdraw',
    requireAuth,
    async (req, res) => {
      const announcement = await withdrawAnnouncement(
        req.user!,
        id.parse(req.params.sectionId),
        id.parse(req.params.announcementId),
      );
      res.status(200).json({ announcement });
    },
  );

  router.post(
    '/sections/:sectionId/activities',
    requireAuth,
    receiveFiles('files', 10),
    async (req, res) => {
      const activity = await createActivity(
        req.user!,
        id.parse(req.params.sectionId),
        activityBody.parse(req.body),
        readIncomingFiles(req.files as Express.Multer.File[] | undefined),
        storage,
      );
      res.status(201).json({ activity });
    },
  );

  router.patch('/sections/:sectionId/activities/:activityId', requireAuth, async (req, res) => {
    const activity = await updateActivity(
      req.user!,
      id.parse(req.params.sectionId),
      id.parse(req.params.activityId),
      activityUpdate.parse(req.body),
    );
    res.status(200).json({ activity });
  });

  router.post(
    '/sections/:sectionId/activities/:activityId/files',
    requireAuth,
    receiveFiles('files', 10),
    async (req, res) => {
      const activity = await addActivityFiles(
        req.user!,
        id.parse(req.params.sectionId),
        id.parse(req.params.activityId),
        readIncomingFiles(req.files as Express.Multer.File[] | undefined),
        storage,
      );
      res.status(200).json({ activity });
    },
  );

  router.post('/sections/:sectionId/activities/:activityId/close', requireAuth, async (req, res) => {
    const activity = await closeActivity(
      req.user!,
      id.parse(req.params.sectionId),
      id.parse(req.params.activityId),
    );
    res.status(200).json({ activity });
  });

  router.post('/activities/:activityId/submission', requireAuth, receiveFiles('file', 1), async (req, res) => {
    const file = readIncomingFiles(req.files as Express.Multer.File[] | undefined)[0];
    if (!file) throw new AppError(400, 'FILE_REQUIRED', 'Tenés que adjuntar un archivo');
    const submission = await submitWork(req.user!, id.parse(req.params.activityId), file, storage);
    res.status(200).json({ submission });
  });

  router.delete('/attachments/:attachmentId', requireAuth, async (req, res) => {
    await removeAttachment(req.user!, id.parse(req.params.attachmentId), storage);
    res.status(204).end();
  });

  router.get('/attachments/:attachmentId', requireAuth, async (req, res) => {
    const { attachment, stream } = await openAttachment(req.user!, id.parse(req.params.attachmentId), storage);
    const safeName = attachment.fileName.replace(/["\r\n]/g, '');
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    stream.pipe(res);
  });

  return router;
}
