import { RoleName, TeachingPosition } from '@prisma/client';
import { Router } from 'express';
import { createRequireAuth, requireRole } from '../../shared/auth/index.js';
import { titleSchema } from '../../shared/validation/fields.js';
import { z } from '../../shared/validation/index.js';
import {
  KNOWN_MIME_TYPES,
  closeSection,
  createProgram,
  createSubject,
  createTerm,
  getSettings,
  listPrograms,
  listSections,
  listSubjects,
  listTeachingSections,
  listTerms,
  openSection,
  setProgramStatus,
  setSubjectStatus,
  updateSettings,
} from './catalog.service.js';

const programBody = z.strictObject({
  name: titleSchema,
  location: titleSchema,
});

const subjectBody = z.strictObject({
  programId: z.number().int().positive(),
  code: z.string().trim().min(1).max(20),
  name: titleSchema,
});

const termBody = z.strictObject({
  year: z.number().int().min(2000).max(2100),
  term: z.union([z.literal(1), z.literal(2)]),
});

const sectionBody = z.strictObject({
  subjectId: z.number().int().positive(),
  termId: z.number().int().positive(),
  name: titleSchema,
  teachers: z
    .array(
      z.strictObject({
        userId: z.number().int().positive(),
        position: z.enum(TeachingPosition),
      }),
    )
    .min(1),
});

const settingsBody = z.strictObject({
  currentTermId: z.number().int().positive().nullable(),
  maxFileSizeBytes: z.number().int().positive(),
  allowedMimeTypes: z.array(z.enum(KNOWN_MIME_TYPES)).min(1),
});

export function createCatalogRouter({ jwtSecret }: { jwtSecret: string }) {
  const router = Router();
  const requireAuth = createRequireAuth(jwtSecret);
  const admin = [requireAuth, requireRole(RoleName.ADMIN)] as const;
  const id = z.coerce.number().int().positive();

  router.get('/programs', ...admin, async (_req, res) => {
    res.status(200).json({ programs: await listPrograms() });
  });
  router.post('/programs', ...admin, async (req, res) => {
    const program = await createProgram(programBody.parse(req.body));
    res.status(201).json({ program });
  });
  router.patch('/programs/:id/status', ...admin, async (req, res) => {
    const status = z.strictObject({ status: z.enum(['ACTIVE', 'INACTIVE']) }).parse(req.body).status;
    const program = await setProgramStatus(id.parse(req.params.id), status);
    res.status(200).json({ program });
  });

  router.get('/subjects', ...admin, async (req, res) => {
    const programId =
      req.query.programId === undefined ? undefined : id.parse(req.query.programId);
    res.status(200).json({ subjects: await listSubjects(programId) });
  });
  router.post('/subjects', ...admin, async (req, res) => {
    const subject = await createSubject(subjectBody.parse(req.body));
    res.status(201).json({ subject });
  });
  router.patch('/subjects/:id/status', ...admin, async (req, res) => {
    const status = z.strictObject({ status: z.enum(['ACTIVE', 'INACTIVE']) }).parse(req.body).status;
    const subject = await setSubjectStatus(id.parse(req.params.id), status);
    res.status(200).json({ subject });
  });

  router.get('/terms', ...admin, async (_req, res) => {
    res.status(200).json({ terms: await listTerms() });
  });
  router.post('/terms', ...admin, async (req, res) => {
    const term = await createTerm(termBody.parse(req.body));
    res.status(201).json({ term });
  });

  router.get('/sections', ...admin, async (_req, res) => {
    res.status(200).json({ sections: await listSections() });
  });
  router.post('/sections', ...admin, async (req, res) => {
    const section = await openSection(sectionBody.parse(req.body));
    res.status(201).json({ section });
  });
  router.post('/sections/:id/close', ...admin, async (req, res) => {
    const section = await closeSection(id.parse(req.params.id));
    res.status(200).json({ section });
  });

  router.get('/settings', ...admin, async (_req, res) => {
    res.status(200).json({ settings: await getSettings() });
  });
  router.patch('/settings', ...admin, async (req, res) => {
    const settings = await updateSettings(settingsBody.parse(req.body));
    res.status(200).json({ settings });
  });

  router.get('/teaching/sections', requireAuth, requireRole(RoleName.TEACHER), async (req, res) => {
    res.status(200).json({ sections: await listTeachingSections(req.user!.id) });
  });

  return router;
}
