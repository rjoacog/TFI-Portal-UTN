# Backend de UTN Connect

API hecha con Node.js, Express 5 y Prisma sobre PostgreSQL. Es un proyecto independiente: se instala y se ejecuta desde esta carpeta.

## Requisitos

Node.js LTS, npm y PostgreSQL 18 instalado localmente.

## Puesta en marcha

```bash
cd backend
npm install
```

Copiá `.env.example` como `.env` en esta carpeta (no se sube al repositorio) y completá tu usuario y contraseña en `DATABASE_URL`. La base `utn_connect` se crea como se explica en el [README principal](../README.md#cómo-empezar).

## Variables de entorno

La API las valida con Zod al iniciar (`src/shared/config/env.ts`). Si falta alguna o es inválida, no arranca y muestra cuál falló. Las variables definidas en el entorno tienen prioridad sobre las de `.env`.

| Variable | Obligatoria | Descripción |
|---|---|---|
| `NODE_ENV` | Sí | `development`, `test` o `production`. |
| `PORT` | No | Puerto de la API. Por defecto, `3000`. |
| `DATABASE_URL` | Sí | Conexión a PostgreSQL (`postgresql://...`). |
| `CORS_ORIGINS` | Sí | Orígenes permitidos, separados por comas, sin ruta ni barra final. En desarrollo, `http://localhost:5173`. |

## Errores

Todas las respuestas de error usan el formato común, descripto en [docs/arquitectura.md](../docs/arquitectura.md#formato-común-de-errores). Desde un servicio o una ruta se lanza un `AppError` (de `src/shared/errors`), y el middleware de errores arma la respuesta.

```ts
throw new AppError(404, 'NOT_FOUND', 'La comisión no existe');
```

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Levanta la API en modo desarrollo (`tsx watch`). |
| `npm run lint` | Revisa el estilo del código (ESLint). |
| `npm run typecheck` | Verifica los tipos (`tsc --noEmit`). |
| `npm run test` | Ejecuta las pruebas (Vitest). |
| `npm run db:migrate` | Aplica las migraciones (`prisma migrate dev`). |
| `npm run db:seed` | Carga el primer administrador y datos de prueba. |

## Estructura

```text
backend/
├─ prisma/     schema.prisma, migraciones y seed.ts
└─ src/        app.ts, server.ts, modules/ y shared/
```
