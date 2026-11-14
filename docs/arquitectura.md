# Arquitectura de UTN Connect

## Stack

| Capa | Tecnología |
|---|---|
| Lenguaje | TypeScript, en modo `strict` |
| Frontend | React + Vite + React Router + Context API. Los datos se piden con `fetch`, a través de un cliente propio. |
| Backend | Node.js (versión LTS) + Express 5 |
| Datos | PostgreSQL (instalado en cada máquina) + Prisma |
| Validación | Zod, con esquemas compartidos en `packages/shared` |
| Contraseñas | argon2 |
| Seguridad HTTP | helmet, express-rate-limit y cors con una lista explícita de orígenes permitidos |
| Archivos | multer para recibirlos; file-type para validar el tipo real |
| Fechas | date-fns + @date-fns/tz |
| Pruebas | Vitest + Supertest |
| Calidad del código | ESLint + Prettier |
| Integración continua | GitHub Actions, con PostgreSQL como servicio |

**Versión de PostgreSQL:** los 3 integrantes y la integración continua tienen que usar **la misma versión mayor**. Queda fijada en `.env.example` y en el workflow.

## Estructura del repositorio

```text
apps/api/src/
  modules/<area>/       routes, service, repository y schemas de cada módulo
  shared/               audit, storage, events, errors, dates, auth (middlewares)
  app.ts
apps/api/prisma/        schema.prisma, migrations/, seed.ts
apps/web/src/
  features/<area>/      pantallas y componentes de cada área
  routes/
  shared/api/           cliente HTTP (envoltorio de fetch)
  shared/session/       contexto de sesión
packages/shared/src/    esquemas Zod, tipos y constantes
```

## Autenticación y sesión

- **La cookie:** el JWT viaja en una cookie con las marcas `httpOnly`, `SameSite=Lax` y `Secure` (esta última, en producción). **Nunca** se guarda en `localStorage`.
- **El token:** contiene `sub` (el id del usuario) y `tv` (su `tokenVersion`). Vence a las 8 horas.
- **El control de cada pedido:** un middleware compara `tv` con el `tokenVersion` guardado en la base y verifica que el usuario esté activo.
- **Invalidar sesiones:** cerrar sesión, desactivar al usuario o restablecer su contraseña **incrementa** `tokenVersion`. Con eso, los tokens que ya existían dejan de servir.
- **Cambio obligatorio de contraseña:** si el usuario tiene `mustChangePassword`, la API solo le permite cambiar la contraseña y cerrar sesión.
- **Inicio de sesión:**
  - Si la cuenta está desactivada **y** la contraseña es correcta, se responde "La cuenta no está habilitada".
  - Cualquier otro fallo responde "Credenciales no válidas", para no revelar qué identificadores existen.
  - Hay un límite de intentos por identificador y por IP.
- **CSRF:** los pedidos que modifican datos se rechazan si la cabecera `Origin` no está en la lista de orígenes permitidos.
- **Desarrollo:** la web llama a la API a través del proxy de Vite, así quedan en el mismo origen.
- **Producción:** la web y la API tienen que quedar bajo el mismo dominio o bajo subdominios del mismo dominio. Si no, la cookie no viaja.

## Cliente HTTP de la web

`src/shared/api` envuelve `fetch` y es el único lugar desde donde se llama a la API:
- envía `credentials: 'include'`;
- serializa el JSON y lee el formato común de errores;
- ante un `401` limpia la sesión y redirige al inicio de sesión;
- ante un `403` con `mustChangePassword` redirige al cambio de contraseña.

Para no repetir el manejo de carga y de errores en cada pantalla, se puede sumar un hook propio (`useApiQuery`) sobre este cliente. **No se agregan librerías de manejo de datos.**

## Integridad en la base de datos

Las reglas que se pueden romper por concurrencia, como un doble clic o dos pedidos simultáneos, se garantizan en PostgreSQL:

- **Unicidades simples** con `@@unique`. Entre otras:
  - `loginId`;
  - (alumno, comisión) en la inscripción;
  - (comisión, fecha) en la clase;
  - (alumno, actividad) en la entrega y en la calificación;
  - (docente, comisión) en la asignación;
  - (año, cuatrimestre) en el período.
- **Una inscripción activa por alumno, materia y período.** Se resuelve con un índice único **parcial**, `WHERE status = 'ACTIVE'`. Para poder declararlo, la inscripción guarda `subjectId` y `termId`, copiados de la comisión al crearla.
- **Un archivo pertenece a exactamente un dueño: material, actividad o entrega.** Se resuelve con una restricción `CHECK` sobre las tres claves foráneas.
- Prisma no puede expresar las dos últimas. Por eso están en **SQL escrito a mano dentro de la migración**. Al modificar esas tablas, hay que verificar que el SQL siga presente.

## Archivos

- **La interfaz `FileStorage`** ofrece `save`, `read`, `remove` y `stream`. En el MVP se implementa sobre el disco local, en una carpeta fuera de lo público. Al publicar el sistema se suma una implementación para S3 o R2, sin tocar los módulos.
- **Las descargas** pasan siempre por un endpoint que verifica el permiso por comisión. **No se sirven como archivos estáticos.**
- **Antes de guardar** se validan el tamaño y el tipo real del archivo (con `file-type`) contra `Settings`.

## Eventos internos

- `announcement.published`: se emite al publicar un anuncio.
- `grade.recorded`: se emite al cargar y al rectificar una nota.
- `enrollment.changed`: se emite cuando cambia el estado de una inscripción.

Cada evento se emite desde un único punto del servicio correspondiente. En el MVP no hay suscriptores: ahí se conectarán las notificaciones más adelante.

## Fechas

- **Fecha y hora:** columnas `timestamptz`, siempre en UTC.
- **Solo fecha** (por ejemplo, la fecha de una clase): columnas `date`.
- **Conversión** a `America/Argentina/Buenos_Aires`: solo al mostrar y al interpretar lo que carga el usuario. Se hace con las funciones de `shared/dates`.
- **El reloj se inyecta** (`clock.now()`) para poder probar los límites sin depender de la hora real.

## Pruebas

- **Cobertura de los issues:** cada criterio de aceptación tiene al menos una prueba. Se priorizan las pruebas de la API con Supertest, contra una base de prueba separada (`DATABASE_URL_TEST`).
- **Permisos:** cada endpoint protegido tiene su prueba de permisos. Otro docente, otro alumno y un usuario sin el rol tienen que recibir el error que corresponde.
- **Bordes de fecha:** las reglas que dependen de fechas se prueban en sus límites. Por ejemplo, el instante exacto de la fecha límite, o una baja justo antes o justo después de la fecha de una clase.
