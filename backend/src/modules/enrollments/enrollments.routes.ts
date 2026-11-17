import { RoleName } from '@prisma/client';
import { Router } from 'express';
import { createRequireAuth, loadSectionAccess, requireRole } from '../../shared/auth/index.js';
import { AppError } from '../../shared/errors/index.js';
import { z } from '../../shared/validation/index.js';
import {
  dropEnrollment,
  enrollSelf,
  listOffer,
  listSectionEnrollments,
  reactivateEnrollment,
} from './enrollments.service.js';

export function createEnrollmentsRouter({ jwtSecret }: { jwtSecret: string }) {
  const router = Router();
  const requireAuth = createRequireAuth(jwtSecret);
  const id = z.coerce.number().int().positive();

  router.get('/offer', requireAuth, requireRole(RoleName.STUDENT), async (req, res) => {
    res.status(200).json({ sections: await listOffer(req.user!.id) });
  });

  router.post('/sections/:sectionId/enrollments', requireAuth, requireRole(RoleName.STUDENT), async (req, res) => {
    const enrollment = await enrollSelf(req.user!.id, id.parse(req.params.sectionId));
    res.status(201).json({ enrollment });
  });

  router.get('/sections/:sectionId/enrollments', requireAuth, async (req, res) => {
    const sectionId = id.parse(req.params.sectionId);
    const access = await loadSectionAccess(req.user!, sectionId);
    if (!access.teaches && req.user!.role !== RoleName.ADMIN) {
      throw new AppError(404, 'NOT_FOUND', 'El recurso solicitado no existe');
    }
    res.status(200).json({ enrollments: await listSectionEnrollments(sectionId) });
  });

  router.post('/enrollments/:enrollmentId/drop', requireAuth, async (req, res) => {
    const enrollment = await dropEnrollment(req.user!, id.parse(req.params.enrollmentId));
    res.status(200).json({ enrollment });
  });

  router.post(
    '/enrollments/:enrollmentId/reactivate',
    requireAuth,
    requireRole(RoleName.ADMIN),
    async (req, res) => {
      const enrollment = await reactivateEnrollment(req.user!, id.parse(req.params.enrollmentId));
      res.status(200).json({ enrollment });
    },
  );

  return router;
}
