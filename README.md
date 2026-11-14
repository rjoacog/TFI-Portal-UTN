# UTN Connect

Aula virtual y gestión de cursado para las tecnicaturas de la UTN (sede Concepción). Trabajo Final Integrador.

El sistema reúne en un solo lugar:
- la oferta de comisiones y la inscripción;
- el material y los anuncios de cada comisión;
- los trabajos prácticos, sus entregas y las calificaciones;
- la asistencia y el historial académico del alumno.

---

## Roles

Una persona es un usuario y puede tener más de un rol.

| Rol | Qué hace en el MVP |
|---|---|
| **Alumno** | Se inscribe a las comisiones de sus carreras y se da de baja. Entra al aula, entrega trabajos prácticos y consulta sus notas, su asistencia y su historial. |
| **Docente** | Opera las comisiones que tiene asignadas: publica material y anuncios, crea actividades, califica, define la nota de aprobación y toma asistencia. |
| **Administrador** | Da de alta usuarios (con una contraseña temporal) y administra roles, carreras, materias, períodos, comisiones, bajas y reactivaciones de inscripciones, y parámetros. |
| **Directivo** | El rol existe, pero sus pantallas quedan para después del MVP. |

---

## Alcance del MVP

**Incluye**
- **Acceso:** inicio de sesión con legajo y contraseña, cambio obligatorio de la contraseña en el primer ingreso, cierre de sesión y edición del perfil.
- **Administración:** usuarios, roles y carreras del alumno; carreras, materias, períodos lectivos y comisiones; configuración.
- **Inscripción:** el alumno se inscribe y la inscripción queda activa al instante. Puede darse de baja. Volver a una comisión después de una baja lo hace el administrador.
- **Aula:** material, anuncios, actividades (trabajos prácticos y evaluaciones) y entregas.
- **Evaluación:**
  - notas enteras de 1 a 10;
  - nota de aprobación definida por comisión;
  - planilla de la comisión, que cruza alumnos con actividades;
  - rectificación de una nota, que queda en la auditoría.
- **Asistencia:** registro por clase, con el porcentaje calculado de forma automática.
- **Historial académico** del alumno.
- **Auditoría** de los cambios sensibles.
- **Reportes con exportación** (PDF, Excel o CSV). Es un requisito de la cátedra y su alcance está por definirse.

**Queda para después**
- Consultas a los docentes en horario de consulta.
- Notificaciones dentro de la plataforma y por correo.
- Recuperación de la contraseña por cuenta propia. Mientras tanto, el administrador la restablece.
- Aprobación de inscripciones (estados pendiente y rechazada), cupos y correlativas.
- Materias compartidas entre carreras (cuando se incorporen las ingenierías).
- Condición del alumno en la materia (regular, libre o promocional).
- Nota final de la materia, mensajería, foros y aplicación móvil nativa.

---

## Stack

| Capa | Tecnología |
|---|---|
| Lenguaje | TypeScript, en modo `strict` |
| Frontend | React, Vite, React Router y Context API. Los datos se piden con `fetch`. |
| Backend | Node.js (versión LTS) y Express 5 |
| Datos | PostgreSQL (instalado localmente) y Prisma |
| Validación | Zod, con esquemas compartidos entre la API y la web |
| Autenticación | JWT en una cookie `httpOnly`, con versión de token para invalidar sesiones |
| Pruebas | Vitest y Supertest |
| Calidad del código | ESLint y Prettier |
| Integración continua | GitHub Actions |

El detalle técnico está en [docs/arquitectura.md](docs/arquitectura.md). El glosario y las reglas de negocio están en [docs/dominio.md](docs/dominio.md).

### Estructura del repositorio

Es un monorepo organizado con npm workspaces:

```text
TFI-Portal-UTN/
├─ apps/
│  ├─ api/                 Express + Prisma
│  │  ├─ prisma/           schema.prisma, migraciones y datos de prueba (seed)
│  │  └─ src/
│  │     ├─ modules/       auth, users, catalog, enrollments, classroom,
│  │     │                 grading, attendance, reports
│  │     └─ shared/        audit, storage, events, errors, dates
│  └─ web/                 React + Vite
│     └─ src/
│        ├─ features/      las mismas áreas que la API
│        ├─ routes/
│        └─ shared/        cliente HTTP y sesión
├─ packages/
│  └─ shared/              esquemas Zod, tipos y constantes
├─ docs/                   dominio y arquitectura
├─ .env.example
└─ .github/                CI y plantillas de issues y de PR
```

---

## Cómo empezar

> Todavía no hay código de aplicación. Esta sección se completa en la etapa 0, con los comandos reales.

Requisitos: Node.js LTS, npm y PostgreSQL instalado localmente, en la versión acordada en `.env.example`.

1. Crear en PostgreSQL dos bases: una de desarrollo y otra de pruebas. Por ejemplo, `utn_connect` y `utn_connect_test`.
2. Seguir estos pasos:

```bash
git clone https://github.com/rjoacog/TFI-Portal-UTN.git
cd TFI-Portal-UTN
cp .env.example .env          # completar DATABASE_URL y DATABASE_URL_TEST
npm install
npm run db:migrate            # aplica las migraciones
npm run db:seed               # primer administrador y datos de prueba
npm run dev                   # levanta la API y la web
```

---

## Cómo trabajamos

- **Issues:** cada tarea es un issue. Las funcionalidades son un issue por caso de uso, con sus criterios de aceptación como lista para tildar. Los issues se crean por etapas, a medida que se avanza.
- **Etiquetas:**
  - `etapa:E0` … `etapa:E7`;
  - `tipo:funcionalidad`, `tipo:tecnico`, `tipo:bug`, `tipo:docs`;
  - `area:api`, `area:web`, `area:db`;
  - `bloqueado` y `pendiente-consulta`.
- **Hitos:**
  - `D1 – Usuarios e inscripción`;
  - `D2 – Recorrido completo del TP`;
  - `D3 – MVP completo`.
- **Ramas:**
  - `main` solo recibe cambios por pull request (PR);
  - hay una rama por issue, con el formato `type/number-short-description`. Por ejemplo, `feat/17-enrollment` o `fix/42-due-date`.
- **Idioma:**
  - en inglés: el código y los mensajes de commit;
  - en español: la documentación, los issues, los PR, los comentarios en el código y los textos que ve el usuario.
- **Commits:** siguen [Conventional Commits](https://www.conventionalcommits.org/es/), en inglés. Por ejemplo, `feat(enrollments): enforce single active enrollment per subject`.
- **Pull requests:**
  - mencionan su issue con `Closes #N`;
  - quien lo abre puede fusionarlo, una vez que la CI esté en verde y se cumpla la lista de "terminado" de la plantilla;
  - pedir una revisión es opcional, pero recomendable si el cambio toca autenticación, permisos o migraciones;
  - se fusionan con *squash and merge*.
- **Secretos:** nunca se suben al repositorio el `.env` ni ninguna credencial.

### Etapas

| Etapa | Contenido | Demostración |
|---|---|---|
| E0 | Fundaciones: monorepo, base de datos, autenticación base, auditoría, archivos y CI | — |
| E1 | Acceso y usuarios | — |
| E2 | Oferta: carreras, materias, períodos y comisiones | — |
| E3 | Inscripción | **D1** |
| E4 | Contenido del aula: material y anuncios | — |
| E5 | Actividades y entregas | — |
| E6 | Evaluación: planilla, calificación y nota de aprobación | **D2** |
| E7 | Asistencia e historial | **D3** (junto con los reportes) |

---

## Decisiones abiertas

- **Identificador de acceso de docentes y administradores:** ¿también es el legajo? ¿Qué pasa si una persona tiene legajo de alumno y legajo docente? Hay que consultarlo con los docentes.
- **Materias compartidas:** ¿las tecnicaturas comparten alguna materia, como Inglés o Matemática?
- **Reportes obligatorios:** qué se exporta, en qué formato y para quién. Hay que consultarlo con la cátedra.
- **Publicación:** todavía no se publica en ningún servidor. Cuando se haga, el frontend y la API tienen que quedar bajo el mismo dominio, para que viaje la cookie de sesión.

---

## Licencia

Uso académico. La define el equipo del TFI.
