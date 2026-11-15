import { Router } from 'express';
import { createRequireAuth } from '../../shared/auth/index.js';
import { z } from '../../shared/validation/index.js';
import { getProfile, updateProfile } from './users.service.js';

/** Nombre o apellido: obligatorio, sin espacios en los extremos y hasta 100 caracteres (E1-3). */
const nameField = z.string().trim().min(1).max(100);

// Estricto: cualquier otro campo (`loginId`, `dni`, `email`, `role`…) se rechaza con 400.
const updateProfileSchema = z.strictObject({
  firstName: nameField,
  lastName: nameField,
});

export function createUsersRouter({ jwtSecret }: { jwtSecret: string }) {
  const router = Router();
  const requireAuth = createRequireAuth(jwtSecret);

  // Sin `allowPasswordChangePending`: con el cambio de contraseña pendiente responde 403.
  // El id sale de la sesión: un usuario solo ve y edita su propio perfil.
  router.get('/me', requireAuth, async (req, res) => {
    const profile = await getProfile((req.user as { id: number }).id);
    res.status(200).json({ user: profile });
  });

  router.patch('/me', requireAuth, async (req, res) => {
    const input = updateProfileSchema.parse(req.body);
    const profile = await updateProfile((req.user as { id: number }).id, input);
    res.status(200).json({ user: profile });
  });

  return router;
}
