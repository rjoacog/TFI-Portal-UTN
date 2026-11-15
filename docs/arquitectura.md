# Arquitectura de UTN Connect

## Stack

| Capa | Tecnología |
|---|---|
| Lenguaje | TypeScript, en modo `strict` |
| Frontend | React + Vite + React Router + Context API. Los datos se piden con `fetch`, a través de un cliente propio. |
| Backend | Node.js 24 (LTS) + Express 5 |
| Datos | PostgreSQL (instalado en cada máquina) + Prisma |
| Validación | Zod, con esquemas propios en cada proyecto (`backend/` y `frontend/`) |
| Contraseñas | argon2 |
| Seguridad HTTP | helmet, express-rate-limit y cors con una lista explícita de orígenes permitidos |
| Archivos | multer para recibirlos; file-type para validar el tipo real |
| Fechas | date-fns + @date-fns/tz |
| Pruebas | Vitest + Supertest |
| Calidad del código | ESLint + Prettier |

**Versión de PostgreSQL:** los 3 integrantes tienen que usar **la misma versión mayor**.

## Estructura del repositorio

```text
backend/src/
  modules/<area>/       routes, service, repository y schemas de cada módulo
  shared/               audit, storage, events, errors, dates, auth (middlewares)
  app.ts
backend/prisma/         schema.prisma, migrations/, seed.ts
frontend/src/
  features/<area>/      pantallas y componentes de cada área
  routes/
  shared/api/           cliente HTTP (envoltorio de fetch)
  shared/session/       contexto de sesión
```

Son dos proyectos independientes: cada uno define sus propios esquemas Zod, tipos y constantes, y no hay paquete compartido.

## Autenticación y sesión

- **La cookie:** el JWT viaja en una cookie con las marcas `httpOnly`, `SameSite=Lax` y `Secure` (esta última, en producción). **Nunca** se guarda en `localStorage`.
- **El token:** contiene `sub` (el id del usuario) y `tv` (su `tokenVersion`). Vence a las 8 horas.
- **El control de cada pedido:** un middleware compara `tv` con el `tokenVersion` guardado en la base y verifica que el usuario esté activo.
- **Invalidar sesiones:** cerrar sesión, desactivar al usuario o restablecer su contraseña **incrementa** `tokenVersion`. Con eso, los tokens que ya existían dejan de servir.
- **Servicio único de contraseñas** (`backend/src/modules/auth/password.service.ts`): es el único lugar que hashea (argon2id), valida la política (al menos 8 caracteres y distinta de la actual), genera contraseñas temporales y escribe `passwordHash`. Lo usan el cambio de contraseña, el alta, el restablecimiento y los seeds. `setPassword` recibe la transacción de quien llama, para que la auditoría vaya en la misma transacción.
- **Cambiar la contraseña invalida las sesiones (E1-2):** todo cambio de contraseña incrementa `tokenVersion`, también el voluntario. `setPassword` devuelve el valor nuevo para firmar la cookie de la sesión actual.
- **Cambio obligatorio de contraseña:** si el usuario tiene `mustChangePassword`, la API solo le permite cambiar la contraseña y cerrar sesión.
- **Inicio de sesión:**
  - Si la cuenta está desactivada **y** la contraseña es correcta, se responde "La cuenta no está habilitada".
  - Cualquier otro fallo responde "Credenciales no válidas", para no revelar qué identificadores existen.
  - Límite de intentos (E1-1), solo en `POST /api/auth/login` y además del límite global: **5 fallidos en 15 minutos por legajo** (la clave es el legajo normalizado, así `ALU1` y `alu1` cuentan juntos) y **50 fallidos en 15 minutos por IP**. Solo cuentan los fallidos; un ingreso correcto reinicia el contador del legajo. Con el límite alcanzado se rechaza aunque la contraseña sea correcta. Los valores se pueden cambiar con `AppOptions.loginRateLimit` (para las pruebas).
  - Si el legajo no existe, igual se verifica la contraseña contra un hash ficticio, para que la respuesta tarde lo mismo.
- **Endpoints de sesión:**
  - `POST /api/auth/login` (público): entrada `{ loginId, password }`; responde 200 con `{ user: { id, loginId, role, firstName, lastName, email, mustChangePassword } }` y escribe la cookie. Un usuario con `mustChangePassword` también inicia sesión.
  - `GET /api/auth/me`: requiere sesión y funciona aunque haya `mustChangePassword`. Responde 200 con el mismo cuerpo que el login. Lo usa la web al cargar para recuperar la sesión.
- **CSRF:** los pedidos que modifican datos se rechazan si la cabecera `Origin` no está en la lista de orígenes permitidos.
- **Desarrollo:** la web llama a la API a través del proxy de Vite, así quedan en el mismo origen.
- **Producción:** la web y la API tienen que quedar bajo el mismo dominio o bajo subdominios del mismo dominio. Si no, la cookie no viaja.

## Formato común de errores

Toda respuesta de error de la API tiene este cuerpo:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Los datos enviados no son válidos",
    "details": [{ "path": "loginId", "message": "Entrada inválida: se esperaba texto, recibido indefinido" }]
  }
}
```

- `code`: identificador estable, en inglés y en mayúsculas. La web decide qué hacer según este campo, no según el texto.
- `message`: texto en español para mostrarle al usuario.
- `details`: opcional. En los errores de validación, la lista de campos con su problema.

Los servicios y las rutas lanzan `AppError(status, code, message)` de `backend/src/shared/errors`. El middleware de errores lo traduce así:

| Caso | HTTP | `code` |
|---|---|---|
| `AppError` | el suyo | el suyo |
| `ZodError` (validación de la entrada) | 400 | `VALIDATION_ERROR` |
| Cuerpo que no es un JSON válido | 400 | `INVALID_JSON` |
| Cuerpo demasiado grande | 413 | `PAYLOAD_TOO_LARGE` |
| La contraseña nueva tiene menos de 8 caracteres ("La contraseña tiene que tener al menos 8 caracteres") | 400 | `PASSWORD_TOO_SHORT` |
| La contraseña nueva es igual a la actual ("La nueva contraseña tiene que ser distinta de la actual") | 400 | `PASSWORD_REUSED` |
| Legajo inexistente o contraseña incorrecta en el inicio de sesión ("Credenciales no válidas"). No es una sesión vencida | 401 | `INVALID_CREDENTIALS` |
| Cuenta desactivada con la contraseña correcta ("La cuenta no está habilitada. Comunicate con la administración.") | 403 | `ACCOUNT_DISABLED` |
| Límite de intentos fallidos de inicio de sesión superado ("Hiciste demasiados intentos fallidos. Esperá 15 minutos y volvé a intentar.") | 429 | `TOO_MANY_LOGIN_ATTEMPTS` |
| Ruta inexistente, o recurso de una comisión a la que el usuario no pertenece | 404 | `NOT_FOUND` |
| Sin sesión: falta la cookie, el token es inválido o venció, `tv` no coincide con `tokenVersion` o el usuario está desactivado | 401 | `UNAUTHENTICATED` |
| El usuario tiene `mustChangePassword` y la ruta no está permitida | 403 | `PASSWORD_CHANGE_REQUIRED` |
| El usuario no tiene el rol que pide la ruta | 403 | `FORBIDDEN` |
| Pedido que modifica datos con una cabecera `Origin` fuera de `CORS_ORIGINS` | 403 | `FORBIDDEN_ORIGIN` |
| Límite global de pedidos superado | 429 | `TOO_MANY_REQUESTS` |
| Cualquier otro error | 500 | `INTERNAL_ERROR` (se registra en el log; al cliente no se le expone el detalle) |

Los mensajes de validación de Zod se muestran en español (`z.config(z.locales.es())`).

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

- **Cobertura de los issues:** cada criterio de aceptación tiene al menos una prueba. Se priorizan las pruebas de la API con Supertest, contra PostgreSQL, en el esquema `test` de la misma base `utn_connect` (variable `DATABASE_URL_TEST`: la misma conexión que `DATABASE_URL`, con `?schema=test`). Los datos de desarrollo quedan en el esquema `public`.
- **Infraestructura (`backend/src/test/`):** todas las pruebas exigen `DATABASE_URL_TEST` con `schema=test`; si falta, no corren. Antes de correr, Vitest aplica las migraciones al esquema `test` (`prisma migrate deploy`) y, durante las pruebas, el cliente de Prisma apunta a ese esquema. Las pruebas no corren en paralelo porque comparten el esquema. Cada prueba que usa la base llama a `resetDatabase()`, que vacía las tablas salvo `settings` y devuelve `settings` a sus valores iniciales; `createUser({ role })` crea una cuenta con un solo rol (por defecto, `STUDENT`), con un legajo con el prefijo del rol, un DNI y un correo generados que no se repiten.
- **Permisos:** cada endpoint protegido tiene su prueba de permisos. Otro docente, otro alumno y un usuario sin el rol tienen que recibir el error que corresponde.
- **Bordes de fecha:** las reglas que dependen de fechas se prueban en sus límites. Por ejemplo, el instante exacto de la fecha límite, o una baja justo antes o justo después de la fecha de una clase.

### Problema conocido: Vitest falla en todos los archivos desde Git Bash (Windows)

- **Síntoma:** `npm run test` falla en **todos** los archivos, sin ejecutar ninguna prueba, con `TypeError: Cannot read properties of undefined (reading 'config')` o `Vitest failed to find the current suite`. Falla igual con el repo sin cambios y con una prueba trivial.
- **Qué lo descarta:** no es el código ni la configuración. Falla también sin `vitest.config.ts` y sin `.env`; borrar la caché de Vite (`node_modules/.vite`) y correr `npm ci` no lo arregla. Que falten carpetas `@vitest/*` en `node_modules` es normal en Vitest 5 (viene empaquetado): no es la causa.
- **Cómo se resuelve:** correr `npm run test` desde **PowerShell** (o desde la terminal de VS Code con PowerShell). Con el mismo código pasan las 43 pruebas. Con `--pool=vmThreads` también pasan en Git Bash, pero no es el modo que usamos.
- **Causa:** sin determinar. Algo del entorno de esa sesión de Git Bash rompe el pool por defecto (`forks`/`threads`) de Vitest; había pasado la misma sesión momentos antes. Si vuelve a pasar, probar en PowerShell **antes** de tocar código, dependencias o configuración.
