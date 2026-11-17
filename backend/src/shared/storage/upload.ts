import multer from 'multer';
import type { RequestHandler } from 'express';
import { prisma } from '../db/index.js';
import { AppError } from '../errors/index.js';

/** Recibe archivos en memoria. El tamaño lo marca la configuración. */
export function receiveFiles(field: string, maxCount: number): RequestHandler {
  return async (req, res, next) => {
    const settings = await prisma.settings.findUniqueOrThrow({ where: { id: 1 } });
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: settings.maxFileSizeBytes, files: maxCount },
    }).array(field, maxCount);
    upload(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        next(new AppError(413, 'FILE_TOO_LARGE', 'El archivo supera el tamaño permitido'));
        return;
      }
      next(err);
    });
  };
}

export interface IncomingFile {
  originalname: string;
  buffer: Buffer;
  size: number;
}

export function readIncomingFiles(files: Express.Multer.File[] | undefined): IncomingFile[] {
  return (files ?? []).map((file) => ({
    originalname: file.originalname,
    buffer: file.buffer,
    size: file.size,
  }));
}
