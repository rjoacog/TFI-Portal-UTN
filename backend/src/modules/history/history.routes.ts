import { RoleName } from '@prisma/client';
import { Router } from 'express';
import { createRequireAuth, requireRole } from '../../shared/auth/index.js';
import { getAcademicHistory } from './history.service.js';

export function createHistoryRouter({ jwtSecret }: { jwtSecret: string }) {
  const router = Router();
  const requireAuth = createRequireAuth(jwtSecret);

  router.get('/history', requireAuth, requireRole(RoleName.STUDENT), async (req, res) => {
    res.status(200).json({ history: await getAcademicHistory(req.user!) });
  });

  return router;
}
