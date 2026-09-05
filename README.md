# Portal Universitario UTN

Portal web para que **alumnos** y **profesores** consulten información académica y gestionen el cursado: materias, asistencia, condición del alumno y material de cátedra.

Este documento es el punto de partida del TFI. Define el alcance inicial, los roles, el MVP y cómo vamos a construir la primera versión.

---

## Visión

Centralizar en un solo lugar la información que hoy suele estar repartida entre planillas, aulas virtuales y avisos sueltos:

- El alumno entra y ve qué cursa, su asistencia, su condición y el material de cada materia.
- El profesor carga asistencia, publica material y consulta el estado de sus cursos.
- Más adelante, un administrador académico podrá dar de alta usuarios, materias y períodos lectivos.

---



## Roles


| Rol               | Qué puede hacer (MVP)                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| **Alumno**        | Iniciar sesión, ver sus materias, asistencia, condición académica y descargar material.           |
| **Profesor**      | Iniciar sesión, ver sus cursos, cargar asistencia, publicar/editar material e informar condición. |
| **Administrador** | (Fase 2) Gestionar usuarios, materias, comisiones y calendario académico.                         |


En el MVP el administrador puede resolverse de forma simple (usuario semilla o scripts) para no frenar el desarrollo.

---



## Alcance del MVP

Objetivo: una primera versión usable, con autenticación y las 4 funciones núcleo.

1. **Autenticación** — login por email/legajo y contraseña, sesión por rol.
2. **Cursado** — listado de materias/comisiones del período actual.
3. **Asistencia** — el profesor registra presentes/ausentes; el alumno consulta su porcentaje.
4. **Condición del alumno** — regular, libre, promocional u otra definida por la cátedra.
5. **Material** — el profesor sube archivos o enlaces; el alumno los consulta por materia.

Queda **fuera del MVP** (se anota para después):

- Inscripción a materias y actas de examen
- Calificaciones detalladas / actas
- Mensajería interna y notificaciones push
- App mobile nativa
- Integración con sistemas reales de la facultad (Sysacad, campus, etc.)

---



## Modelo de dominio (simplificado)

```
Usuario (alumno | profesor | admin)
  └── Comisión (materia + docente + período)
        ├── Inscripción (alumno en esa comisión)
        ├── Asistencia (fecha + estado)
        ├── Condición (estado académico del alumno)
        └── Material (archivo o enlace publicado por el docente)
```

Reglas iniciales:

- Un usuario tiene un único rol en el MVP.
- Un profesor puede dictar varias comisiones.
- Un alumno puede estar inscripto en varias comisiones.
- La condición y la asistencia viven a nivel **alumno + comisión**.

---



## Stack propuesto (A REVISAR)

Elegimos un stack web moderno, con TypeScript de punta a punta, para ir rápido y mantener el código ordenado.


| Capa     | Tecnología                                               | Para qué                        |
| -------- | -------------------------------------------------------- | ------------------------------- |
| App      | [Next.js](https://nextjs.org/) (App Router) + TypeScript | Frontend y API en el mismo repo |
| Estilos  | Tailwind CSS                                             | UI rápida y consistente         |
| Datos    | PostgreSQL + [Prisma](https://www.prisma.io/)            | Persistencia y migraciones      |
| Auth     | NextAuth / Auth.js                                       | Sesión y control por rol        |
| Archivos | Storage local (MVP) / S3-compatible después              | Material de cátedra             |


Alternativas válidas si el equipo prefiere otro camino: backend NestJS o Spring Boot, y frontend React separado. El README se ajusta cuando se confirme.

---



## Estructura prevista del repo

Monorepo simple (un solo proyecto Next.js para empezar):

```text
TFI-Portal-UTN/
├── README.md
├── prisma/
│   └── schema.prisma
├── public/
├── src/
│   ├── app/                 # rutas y páginas
│   │   ├── (auth)/          # login
│   │   ├── (alumno)/        # vistas del alumno
│   │   ├── (profesor)/      # vistas del profesor
│   │   └── api/             # endpoints
│   ├── components/
│   ├── lib/                 # prisma, auth, utilidades
│   └── types/
└── ...
```

---



## Cómo empezar (cuando exista el código)

Requisitos: Node.js 20+, npm o pnpm, y PostgreSQL.

```bash
git clone <url-del-repo>
cd TFI-Portal-UTN
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev
```

La app va a quedar en `http://localhost:3000`.

> El scaffolding del proyecto (Next.js, Prisma, login) es el siguiente paso de implementación. Este README deja el mapa; todavía no hay código de aplicación.

---



## Roadmap corto


| Fase | Entrega                            | Estado    |
| ---- | ---------------------------------- | --------- |
| 0    | README, alcance y stack            | En curso  |
| 1    | Scaffold + auth + roles            | Pendiente |
| 2    | Materias / comisiones + dashboards | Pendiente |
| 3    | Asistencia y condición             | Pendiente |
| 4    | Carga y consulta de material       | Pendiente |
| 5    | Pulido, validaciones y demo TFI    | Pendiente |


---



## Decisiones abiertas

Para no bloquear el arranque, estas se pueden cerrar en la próxima reunión:

- ¿Legajo, DNI o email como identificador de login?
- ¿La condición la carga el profesor a mano o se calcula (asistencia + notas)?
- ¿El material son solo PDFs/enlaces, o también avisos de texto?
- ¿Usamos un único período lectivo en el MVP o ya modelamos ciclos (1° / 2° cuatrimestre)?

---



## Equipo y convenciones

- Este es el Trabajo Final Integrador del portal universitario.
- Commits en español o inglés, pero consistentes. Mensajes cortos que expliquen el *por qué*.
- Una funcionalidad por PR / entrega cuando el repo ya tenga ramas de trabajo.
- No commitear `.env` ni credenciales.

---



## Licencia

Uso académico. A definir por el equipo del TFI.