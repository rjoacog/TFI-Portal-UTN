# CLAUDE.md

**UTN Connect** es un aula virtual con gestión de cursado para las tecnicaturas de la UTN. Es un TFI hecho por 3 personas y está pensado para llegar a producción. El alcance y las etapas están en el [README](README.md).

## Documentación de referencia

Leer el archivo que corresponda **antes** de trabajar en el área:

- [docs/dominio.md](docs/dominio.md): glosario con los nombres en código, estados y reglas de negocio. Se lee para cualquier tarea de la API o de la base de datos.
- [docs/arquitectura.md](docs/arquitectura.md): autenticación, integridad en la base de datos, archivos, eventos, fechas y pruebas.

## Idioma

- **Código en inglés**: identificadores, nombres de archivos, rutas, ramas y **mensajes de commit**. Los nombres del dominio salen del glosario de `docs/dominio.md`. No hay que inventar traducciones.
- **En español**:
  - la documentación, los issues y los PR;
  - los **comentarios en el código**;
  - los textos que ve el usuario: la interfaz y los mensajes de error.

## Comandos

> Se definen en la etapa 0. Hay que actualizar esta sección cada vez que se agregue o cambie un script.

```bash
npm run dev          # levanta la API y la web
npm run test         # ejecuta las pruebas (Vitest)
npm run lint         # revisa el estilo del código (ESLint)
npm run typecheck    # verifica los tipos (tsc --noEmit)
npm run db:migrate   # aplica las migraciones (prisma migrate dev)
npm run db:seed      # crea el primer administrador y carga datos de prueba
```

PostgreSQL corre instalado en cada máquina, sin Docker. La conexión se configura en `.env`.

Antes de dar una tarea por terminada, tienen que pasar `lint`, `typecheck` y `test`.

## Arquitectura

Es un monorepo con npm workspaces:
- `apps/api`: Express 5 y Prisma;
- `apps/web`: React, Vite y React Router;
- `packages/shared`: esquemas Zod, tipos y constantes.

**En la API**, cada módulo de `src/modules/<area>` tiene tres capas:
- **rutas**: validan la entrada con Zod y llaman al servicio, sin lógica de negocio;
- **servicios**: contienen **todas** las reglas de negocio;
- **repositorios**: hacen las consultas con Prisma.

**En la web**:
- las llamadas a la API pasan **siempre** por el cliente de `src/shared/api` (un envoltorio de `fetch`), nunca por `fetch` directo;
- Context API se usa solo para la sesión.

## Reglas obligatorias

1. **Permisos por comisión.** No alcanza con verificar el rol: el usuario tiene que estar asignado o inscripto en la comisión. Si no tiene permiso, se responde **404**.
2. **Para saber si una inscripción da acceso, preguntar por `ACTIVE`**, nunca por "no está dada de baja".
3. **No se borran** calificaciones, entregas, inscripciones ni registros de asistencia. El material y los anuncios se retiran cambiando su estado.
4. **La auditoría se escribe en la misma transacción que el cambio.** Ver `docs/dominio.md`.
5. **Fechas en UTC.** La conversión a la hora de Argentina se hace solo para mostrarla o para leer lo que carga el usuario.
6. **Las unicidades se garantizan en la base de datos**, no solo en el código. Hay SQL escrito a mano en las migraciones que no hay que borrar.
7. **Las contraseñas se cambian en un solo servicio.** Los archivos se guardan siempre con `FileStorage`. Los eventos se emiten desde un único punto.
8. **Ante una ambigüedad que el issue no resuelve, preguntar.** No hay que inventar reglas de negocio.

## Fuera de alcance

No se implementa, aunque parezca útil:
- consultas a docentes;
- notificaciones (solo existen los eventos internos);
- recuperación de contraseña por cuenta propia;
- inscripciones en estado pendiente o rechazada;
- materias compartidas entre carreras;
- pantallas del directivo;
- pantalla de consulta de la auditoría;
- condición del alumno (regular, libre o promocional);
- nota final de la materia;
- envío de correos.

## Cómo trabajar un issue

1. Leer el issue. **El issue define el alcance**: ahí están los criterios de aceptación y las reglas que aplican.
2. Crear una rama desde `main` actualizada, con el formato `type/number-short-description`. Por ejemplo: `feat/17-enrollment`.
3. Hacer los cambios en este orden: esquema y migración, después el servicio, después la ruta y por último la interfaz.
4. Escribir las pruebas: una por cada criterio de aceptación, más la prueba de permisos.
5. Hacer los commits con Conventional Commits, en inglés. Por ejemplo: `feat(enrollments): enforce single active enrollment per subject`.
6. Abrir el PR con la plantilla. En el cuerpo, incluir `Closes #N`.

**Nunca:**
- hacer push directo a `main`;
- subir `.env` o credenciales;
- desactivar pruebas o reglas de lint para que algo pase.
