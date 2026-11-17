import { TZDate } from '@date-fns/tz';

/** Hora oficial de la sede Concepción. */
export const ARGENTINA_TZ = 'America/Argentina/Buenos_Aires';

type Now = () => Date;

let nowFn: Now = () => new Date();

/** Reloj inyectable, para probar los límites sin depender de la hora real. */
export const clock = {
  now: () => nowFn(),
  set(next: Now) {
    nowFn = next;
  },
  reset() {
    nowFn = () => new Date();
  },
};

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** Fecha calendario de un instante, en la hora de Argentina (`YYYY-MM-DD`). */
export function argentinaDate(instant: Date = clock.now()): string {
  const zoned = new TZDate(instant, ARGENTINA_TZ);
  return `${zoned.getFullYear()}-${pad(zoned.getMonth() + 1)}-${pad(zoned.getDate())}`;
}

/** Interpreta `YYYY-MM-DDTHH:mm` como hora de Argentina y devuelve el instante UTC. */
export function parseArgentinaDateTime(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    throw new Error('Fecha inválida');
  }
  const [, year, month, day, hour, minute] = match;
  return new TZDate(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    ARGENTINA_TZ,
  );
}

/** Último instante del día calendario en Argentina. */
export function endOfArgentinaDay(date: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error('Fecha inválida');
  const [, year, month, day] = match;
  return new TZDate(
    Number(year),
    Number(month) - 1,
    Number(day),
    23,
    59,
    59,
    999,
    ARGENTINA_TZ,
  );
}

/** `true` si la fecha calendario es posterior a hoy en Argentina. */
export function isFutureDate(date: string, instant: Date = clock.now()): boolean {
  return date > argentinaDate(instant);
}

/** Texto para mostrar una fecha y hora en Argentina. */
export function formatArgentina(instant: Date): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ARGENTINA_TZ,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(instant);
}
