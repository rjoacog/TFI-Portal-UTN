import { Router } from 'express';
import { createRequireAuth } from '../../shared/auth/index.js';
import { gradeSchema } from '../../shared/validation/fields.js';
import { z } from '../../shared/validation/index.js';
import { getSectionSheet, recordGrade, setPassingGrade } from './grading.service.js';

export function createGradingRouter({ jwtSecret }: { jwtSecret: string }) {
  const router = Router();
  const requireAuth = createRequireAuth(jwtSecret);
  const id = z.coerce.number().int().positive();

  router.get('/sections/:sectionId/sheet', requireAuth, async (req, res) => {
    const sheet = await getSectionSheet(req.user!, id.parse(req.params.sectionId));
    res.status(200).json({ sheet });
  });

  router.put('/activities/:activityId/grade', requireAuth, async (req, res) => {
    const body = z
      .strictObject({
        userId: z.number().int().positive(),
        value: gradeSchema,
        observation: z.string().trim().max(1000).optional(),
      })
      .parse(req.body);
    const grade = await recordGrade(req.user!, id.parse(req.params.activityId), body);
    res.status(200).json({ grade });
  });

  router.patch('/sections/:sectionId/passing-grade', requireAuth, async (req, res) => {
    const body = z.strictObject({ passingGrade: gradeSchema }).parse(req.body);
    const section = await setPassingGrade(req.user!, id.parse(req.params.sectionId), body.passingGrade);
    res.status(200).json({ section });
  });

  return router;
}
