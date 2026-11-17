/**
 * Eventos internos. En la versión 1 no hay suscriptores: las notificaciones se conectan acá
 * sin volver a tocar el aula.
 */
export type DomainEvent =
  | {
      name: 'announcement.published';
      announcementId: number;
      sectionId: number;
    }
  | {
      name: 'grade.recorded';
      gradeId: number;
      studentId: number;
      sectionId: number;
      rectified: boolean;
    }
  | {
      name: 'enrollment.changed';
      enrollmentId: number;
      studentId: number;
      status: 'ACTIVE' | 'DROPPED';
    };

type Handler = (event: DomainEvent) => void;

const handlers = new Set<Handler>();

/** Registra un consumidor. Devuelve la función para darlo de baja. */
export function subscribe(handler: Handler) {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

/** Emite desde el único punto del servicio que corresponde. */
export function emit(event: DomainEvent) {
  for (const handler of handlers) handler(event);
}
