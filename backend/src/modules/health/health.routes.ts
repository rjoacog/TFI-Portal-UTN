import { Router } from 'express';

export const healthRouter = Router();

// No consulta la base: solo indica que la API está levantada.
healthRouter.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});
