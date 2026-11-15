import { PrismaClient } from '@prisma/client';

/** Única instancia de `PrismaClient`. Los repositorios la importan; ningún módulo crea la suya. */
export const prisma = new PrismaClient();
