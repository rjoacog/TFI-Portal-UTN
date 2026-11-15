# Backend de UTN Connect

API hecha con Node.js, Express 5 y Prisma sobre PostgreSQL. Es un proyecto independiente: se instala y se ejecuta desde esta carpeta.

## Requisitos

Node.js 24, npm y PostgreSQL 18 instalado localmente.

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
| `JWT_SECRET` | Sí | Secreto para firmar los tokens de sesión. Al menos 32 caracteres; si falta o es más corto, la API no arranca. Cambiarlo cierra todas las sesiones. |
| `SEED_ADMIN_LOGIN_ID` | Solo para el seed | Legajo del primer administrador: el prefijo `adm` seguido solo de dígitos (por ejemplo, `adm1`). Se valida. |
| `SEED_ADMIN_DNI` | Solo para el seed | DNI del primer administrador: 7 u 8 dígitos, sin puntos. |
| `SEED_ADMIN_EMAIL` | Solo para el seed | Correo del primer administrador. |
| `SEED_ADMIN_PASSWORD` | Solo para el seed | Contraseña temporal del primer administrador (al menos 8 caracteres). Queda con `mustChangePassword = true`. |
| `SEED_DEV_PASSWORD` | Solo para `db:seed:dev` | Contraseña común de los usuarios de prueba (al menos 8 caracteres). |

`npm run db:seed` valida las variables con Zod, crea la cuenta con el rol `ADMIN` (nombre fijo "Administrador Sistema", que se cambia después desde el perfil) y, si ya existe un usuario con ese `loginId`, no lo duplica. La fila de `Settings` la carga la primera migración.

> **Aviso (una cuenta por legajo, #27):** la migración `account_per_legajo` no convierte datos existentes. Después de traer estos cambios, cada integrante corre `npx prisma migrate reset` y vuelve a cargar los seeds (`npm run db:seed` y `npm run db:seed:dev`). Si el esquema `test` ya tiene datos, también hay que resetearlo (con `DATABASE_URL` apuntando a `DATABASE_URL_TEST`).

## Datos de prueba (solo para desarrollo)

`npm run db:seed:dev` carga datos ficticios: 2 carreras con sus materias, el período vigente (año y cuatrimestre actuales, configurado en `Settings.currentTermId`) y comisiones abiertas con aula, docente titular y, en `PROG1`, un auxiliar. Se puede ejecutar varias veces sin duplicar. Con `NODE_ENV=production` no se ejecuta.

Todos los usuarios tienen DNI, la contraseña de `SEED_DEV_PASSWORD` y `mustChangePassword = false`. **Son solo para desarrollo: nunca se cargan en producción.**

| Legajo (`loginId`) | Rol | Notas |
|---|---|---|
| `doc1`, `doc2` | Docente | Titulares; `doc2` es auxiliar en `PROG1`. |
| `alu10001`, `alu10002` | Alumno | Carrera de Programación. |
| `alu10003`, `alu10004` | Alumno | Carrera de Sistemas Informáticos. |
| `alu10005` | Alumno | Cursa las dos carreras. |
| `dir1` | Directivo | |
| `doc3` y `alu10006` | Docente y alumno | Dos cuentas con el mismo DNI (una persona con dos roles). `doc3` es titular de `SO1` (Sistemas); `alu10006` cursa Programación. Para probar la regla de docente y alumno de la misma comisión. |
| `alu10099` | Alumno | Desactivado: para probar "La cuenta no está habilitada". |

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
| `npm run build` | Compila a `dist/`. |
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
