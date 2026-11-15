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
| `DATABASE_URL_TEST` | Solo para las pruebas | Misma conexión que `DATABASE_URL`, con `?schema=test` al final. La API no la valida al iniciar; las pruebas no corren si falta o no indica `schema=test`. |
| `CORS_ORIGINS` | Sí | Orígenes permitidos, separados por comas, sin ruta ni barra final. En desarrollo, `http://localhost:5173`. |
| `SEED_ADMIN_LOGIN_ID` | Solo para el seed | `loginId` del primer administrador. |
| `SEED_ADMIN_EMAIL` | Solo para el seed | Correo del primer administrador. |
| `SEED_ADMIN_PASSWORD` | Solo para el seed | Contraseña temporal del primer administrador (al menos 8 caracteres). Queda con `mustChangePassword = true`. |
| `SEED_DEV_PASSWORD` | Solo para `db:seed:dev` | Contraseña común de los usuarios de prueba (al menos 8 caracteres). |

`npm run db:seed` valida las tres con Zod, crea el usuario con el rol `ADMIN` (nombre fijo "Administrador Sistema", que se cambia después desde el perfil) y, si ya existe un usuario con ese `loginId`, no lo duplica. Los roles y la fila de `Settings` los carga la primera migración.

## Datos de prueba (solo para desarrollo)

`npm run db:seed:dev` carga datos ficticios: 2 carreras con sus materias, el período vigente (año y cuatrimestre actuales, configurado en `Settings.currentTermId`) y comisiones abiertas con aula, docente titular y, en `PROG1`, un auxiliar. Se puede ejecutar varias veces sin duplicar. Con `NODE_ENV=production` no se ejecuta.

Todos los usuarios tienen la contraseña de `SEED_DEV_PASSWORD` y `mustChangePassword = false`. **Son solo para desarrollo: nunca se cargan en producción.**

| loginId | Roles | Notas |
|---|---|---|
| `docente1`, `docente2` | Docente | Titulares; `docente2` es auxiliar en `PROG1`. |
| `10001`, `10002` | Alumno | Carrera de Programación. |
| `10003`, `10004` | Alumno | Carrera de Sistemas Informáticos. |
| `10005` | Alumno | Cursa las dos carreras. |
| `directivo1` | Directivo | |
| `mixto1` | Docente y alumno | Titular de `SO1` (Sistemas); alumno de Programación. Para probar la regla de docente y alumno de la misma comisión. |
| `10099` | Alumno | Desactivado: para probar "La cuenta no está habilitada". |

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
| `npm run db:seed` | Crea el primer administrador (variables `SEED_ADMIN_*`). |
| `npm run db:seed:dev` | Carga datos ficticios de desarrollo (variable `SEED_DEV_PASSWORD`). No se ejecuta con `NODE_ENV=production`. |

## Estructura

```text
backend/
├─ prisma/     schema.prisma, migraciones y seed.ts
└─ src/        app.ts, server.ts, modules/ y shared/
```
