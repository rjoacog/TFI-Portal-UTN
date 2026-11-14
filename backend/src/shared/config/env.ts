import { z } from '../validation/index.js';

/** Un origen es esquema, host y puerto, sin ruta ni barra final (por ejemplo, `http://localhost:5173`). */
function isOrigin(value: string) {
  try {
    return new URL(value).origin === value;
  } catch {
    return false;
  }
}

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: (issue) =>
      issue.input === undefined
        ? 'Es obligatoria'
        : 'Tiene que ser una URL de PostgreSQL (postgresql://...)',
  }),
  CORS_ORIGINS: z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin !== ''),
    )
    .pipe(
      z
        .array(
          z.string().refine(isOrigin, {
            error: (issue) =>
              `"${String(issue.input)}" no es un origen válido (esquema, host y puerto, sin ruta ni barra final)`,
          }),
        )
        .min(1, { error: 'Tiene que haber al menos un origen' }),
    ),
});

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  constructor(readonly problems: string[]) {
    super(`Variables de entorno inválidas:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'EnvValidationError';
  }
}

/** Valida las variables de entorno. Si alguna falta o es inválida, lanza `EnvValidationError`. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => {
      const variable = String(issue.path[0] ?? '(desconocida)');
      return `${variable}: ${issue.message}`;
    });
    throw new EnvValidationError(problems);
  }
  return result.data;
}
