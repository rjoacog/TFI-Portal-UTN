import { AttendanceValue } from '@prisma/client';
import { Router } from 'express';
import { createRequireAuth } from '../../shared/auth/index.js';
import { dateOnlySchema } from '../../shared/validation/fields.js';
import { z } from '../../shared/validation/index.js';
import { correctClass, listClasses, registerClass } from './attendance.service.js';

export function createAttendanceRouter({ jwtSecret }: { jwtSecret: string }) {
  const router = Router();
  const requireAuth = createRequireAuth(jwtSecret);
  const id = z.coerce.number().int().positive();

  router.get('/sections/:sectionId/classes', requireAuth, async (req, res) => {
    const classes = await listClasses(req.user!, id.parse(req.params.sectionId));
    res.status(200).json({ classes });
  });

  router.post('/sections/:sectionId/classes', requireAuth, async (req, res) => {
    const body = z.strictObject({ date: dateOnlySchema }).parse(req.body);
    const classSession = await registerClass(req.user!, id.parse(req.params.sectionId), body.date);
    res.status(201).json({ classSession });
  });

  router.patch('/classes/:classSessionId', requireAuth, async (req, res) => {
    const body = z
      .strictObject({
        records: z.array(
          z.strictObject({
            userId: z.number().int().positive(),
            value: z.enum(AttendanceValue),
          }),
        ),
      })
      .parse(req.body);
    const classSession = await correctClass(req.user!, id.parse(req.params.classSessionId), body.records);
    res.status(200).json({ classSession });
  });

  return router;
}
