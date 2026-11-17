import { z } from './index.js';

export const titleSchema = z.string().trim().min(1).max(200);
export const longTextSchema = z.string().trim().min(1).max(5000);
export const nameSchema = z.string().trim().min(1).max(100);
export const gradeSchema = z.number().int().min(1).max(10);
export const idSchema = z.number().int().positive();

/** `YYYY-MM-DDTHH:mm`, sin zona: el servicio la lee como hora de Argentina. */
export const argentinaDateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { error: 'Usá el formato AAAA-MM-DDTHH:mm' });

export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Usá el formato AAAA-MM-DD' });
