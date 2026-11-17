import type { AuditObject, Prisma } from '@prisma/client';

export interface AuditEntry {
  actorId: number;
  objectType: AuditObject;
  objectId: number;
  field: string;
  previousValue: string | null;
  newValue: string | null;
}

/** Escribe la auditoría en la transacción del cambio. No tiene efecto fuera de esa transacción. */
export function writeAudit(tx: Prisma.TransactionClient, entry: AuditEntry) {
  return tx.auditLog.create({ data: entry });
}
