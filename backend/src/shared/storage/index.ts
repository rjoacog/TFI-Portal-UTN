import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileTypeFromBuffer } from 'file-type';
import { AppError } from '../errors/index.js';

export interface StoredFile {
  storageKey: string;
}

/** Único acceso a los archivos. El MVP guarda en disco, fuera de lo público. */
export interface FileStorage {
  save(data: Buffer): Promise<StoredFile>;
  read(storageKey: string): Promise<Buffer>;
  remove(storageKey: string): Promise<void>;
  stream(storageKey: string): Readable;
}

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Tipo real del archivo. Un DOCX es un ZIP: si contiene `word/`, se clasifica como DOCX
 * y no como un ZIP genérico.
 */
export async function detectMimeType(data: Buffer): Promise<string | undefined> {
  const detected = await fileTypeFromBuffer(data);
  if (!detected) return undefined;
  if (detected.mime === 'application/zip' || detected.mime === 'application/x-zip-compressed') {
    if (data.includes(Buffer.from('word/'))) return DOCX;
    return 'application/zip';
  }
  return detected.mime;
}

export function assertAllowedFile(
  data: Buffer,
  mimeType: string | undefined,
  settings: { maxFileSizeBytes: number; allowedMimeTypes: string[] },
) {
  if (data.length > settings.maxFileSizeBytes) {
    throw new AppError(413, 'FILE_TOO_LARGE', 'El archivo supera el tamaño permitido');
  }
  if (!mimeType || !settings.allowedMimeTypes.includes(mimeType)) {
    throw new AppError(400, 'FILE_TYPE_NOT_ALLOWED', 'El tipo de archivo no está permitido');
  }
}

export class LocalFileStorage implements FileStorage {
  constructor(private readonly root: string) {}

  private resolve(storageKey: string) {
    if (!/^[0-9a-f-]{36}$/.test(storageKey)) {
      throw new AppError(404, 'NOT_FOUND', 'El recurso solicitado no existe');
    }
    const full = path.resolve(this.root, storageKey);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) {
      throw new AppError(404, 'NOT_FOUND', 'El recurso solicitado no existe');
    }
    return full;
  }

  async save(data: Buffer): Promise<StoredFile> {
    await mkdir(this.root, { recursive: true });
    const storageKey = randomUUID();
    await writeFile(this.resolve(storageKey), data);
    return { storageKey };
  }

  read(storageKey: string) {
    return readFile(this.resolve(storageKey));
  }

  async remove(storageKey: string) {
    await rm(this.resolve(storageKey), { force: true });
  }

  stream(storageKey: string) {
    return createReadStream(this.resolve(storageKey));
  }
}

/** Carpeta de archivos del proceso. `FILE_STORAGE_DIR` es opcional. */
export function defaultStorageRoot() {
  return process.env.FILE_STORAGE_DIR && process.env.FILE_STORAGE_DIR.trim() !== ''
    ? process.env.FILE_STORAGE_DIR
    : path.resolve('uploads');
}
