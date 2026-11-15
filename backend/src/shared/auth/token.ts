import jwt from 'jsonwebtoken';

/** Duración del token y de la cookie de sesión: 8 horas. */
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export interface TokenPayload {
  /** Id del usuario. */
  sub: number;
  /** `tokenVersion` del usuario al firmar el token. */
  tv: number;
}

/** Firma el token de sesión con `sub` y `tv`; vence a las 8 horas. */
export function signToken(payload: TokenPayload, secret: string): string {
  return jwt.sign({ tv: payload.tv }, secret, {
    algorithm: 'HS256',
    subject: String(payload.sub),
    expiresIn: SESSION_TTL_SECONDS,
  });
}

/**
 * Verifica la firma y el vencimiento. Devuelve `null` si el token es inválido, está vencido
 * o no trae `sub` y `tv` con el formato esperado.
 */
export function verifyToken(token: string, secret: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (typeof decoded === 'string') return null;
    const sub = Number(decoded.sub);
    const { tv } = decoded as { tv?: unknown };
    if (!Number.isInteger(sub) || typeof tv !== 'number' || !Number.isInteger(tv)) return null;
    return { sub, tv };
  } catch {
    return null;
  }
}
