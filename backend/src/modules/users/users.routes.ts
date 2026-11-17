import { RoleName, UserStatus } from '@prisma/client';
import { Router } from 'express';
import { createRequireAuth, requireRole } from '../../shared/auth/index.js';
import { dniSchema } from '../../shared/identity/index.js';
import { nameSchema } from '../../shared/validation/fields.js';
import { z } from '../../shared/validation/index.js';
import { createUser, listUsers, resetUserPassword, setStudentPrograms, setUserStatus } from './users.admin.service.js';
import { getProfile, updateProfile } from './users.service.js';

/** Nombre o apellido: obligatorio, sin espacios en los extremos y hasta 100 caracteres (E1-3). */
const nameField = z.string().trim().min(1).max(100);

// Estricto: cualquier otro campo (`loginId`, `dni`, `email`, `role`…) se rechaza con 400.
const updateProfileSchema = z.strictObject({
  firstName: nameField,
  lastName: nameField,
});

const createUserSchema = z.strictObject({
  role: z.enum(RoleName),
  legajoNumber: z.string().regex(/^\d+$/, { error: 'El número de legajo tiene que tener solo dígitos' }),
  dni: dniSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  email: z.email({ error: 'Tiene que ser un correo válido' }),
  programIds: z.array(z.number().int().positive()).default([]),
});

const statusSchema = z.strictObject({ status: z.enum(UserStatus) });
const programsSchema = z.strictObject({
  programIds: z.array(z.number().int().positive()).min(1),
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

  const admin = [requireAuth, requireRole(RoleName.ADMIN)] as const;

  router.get('/', ...admin, async (_req, res) => {
    res.status(200).json({ users: await listUsers() });
  });

  router.post('/', ...admin, async (req, res) => {
    const input = createUserSchema.parse(req.body);
    const result = await createUser(req.user!.id, input);
    res.status(201).json(result);
  });

  router.patch('/:userId/status', ...admin, async (req, res) => {
    const userId = z.coerce.number().int().positive().parse(req.params.userId);
    const input = statusSchema.parse(req.body);
    const user = await setUserStatus(req.user!.id, userId, input.status);
    res.status(200).json({ user });
  });

  router.post('/:userId/password-reset', ...admin, async (req, res) => {
    const userId = z.coerce.number().int().positive().parse(req.params.userId);
    const result = await resetUserPassword(req.user!.id, userId);
    res.status(200).json(result);
  });

  router.put('/:userId/programs', ...admin, async (req, res) => {
    const userId = z.coerce.number().int().positive().parse(req.params.userId);
    const input = programsSchema.parse(req.body);
    const user = await setStudentPrograms(req.user!.id, userId, input.programIds);
    res.status(200).json({ user });
  });

  return router;
}
