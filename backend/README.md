# Backend de UTN Connect

API hecha con Node.js, Express 5 y Prisma sobre PostgreSQL. Es un proyecto independiente: se instala y se ejecuta desde esta carpeta.

## Requisitos

Node.js LTS, npm y PostgreSQL 18 instalado localmente.

## Puesta en marcha

```bash
cd backend
npm install
```

La conexión a la base se configura con la variable `DATABASE_URL`. Copiá `.env.example` como `.env` en esta carpeta (no se sube al repositorio) y completá tu usuario y contraseña. La base `utn_connect` se crea como se explica en el [README principal](../README.md#cómo-empezar).

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
