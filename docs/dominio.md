# Dominio de UTN Connect

Este documento reúne el glosario, los nombres que se usan en el código y las reglas de negocio. **Si un issue y este documento se contradicen, vale el issue.** En ese caso hay que actualizar este documento en el mismo PR.

## Glosario y nombres en código

| Concepto | Nombre en código | Estados o valores |
|---|---|---|
| Usuario (una cuenta por legajo) | `User` | `ACTIVE`, `DISABLED` |
| Legajo (identificador de acceso, con prefijo por rol) | `User.loginId` | por ejemplo, `alu12345` |
| Rol (uno por cuenta) | `User.role` | `STUDENT`, `TEACHER`, `ADMIN`, `DIRECTOR` |
| DNI (7 u 8 dígitos, sin puntos) | `User.dni` | — |
| Correo (dato de contacto, puede repetirse) | `User.email` | — |
| Marca "debe cambiar contraseña" | `User.mustChangePassword` | — |
| Versión de token | `User.tokenVersion` | — |
| Carrera | `Program` | `ACTIVE`, `INACTIVE` |
| Sede de la carrera (texto) | `Program.location` | — |
| Carrera del alumno | `StudentProgram` | — |
| Materia | `Subject` | `ACTIVE`, `INACTIVE` |
| Período lectivo | `AcademicTerm` | `year`, `term` (1 o 2) |
| Comisión | `Section` | `OPEN`, `CLOSED` |
| Nota de aprobación | `Section.passingGrade` | entero de 1 a 10, o `null` |
| Aula virtual | `Classroom` | — |
| Asignación docente | `TeachingAssignment` | `LEAD` (titular), `ASSISTANT` (auxiliar) |
| Cargo del docente en la comisión | `TeachingAssignment.position` | `LEAD`, `ASSISTANT` |
| Inscripción | `Enrollment` | `ACTIVE`, `DROPPED` |
| Historial de estados de la inscripción | `EnrollmentStatusChange` | — |
| Material | `Material` | `PUBLISHED`, `WITHDRAWN` |
| Anuncio | `Announcement` | `PUBLISHED`, `WITHDRAWN` |
| Archivo | `Attachment` | — |
| Actividad | `Activity` | tipo: `ASSIGNMENT` (TP), `ASSESSMENT` (evaluación) · estado: `PUBLISHED`, `CLOSED` |
| Entrega | `Submission` | estado: `SUBMITTED`, `GRADED` · presentación (`timeliness`): `ON_TIME`, `LATE` |
| Calificación | `Grade` | `value` (entero de 1 a 10), `withoutSubmission` |
| Clase | `ClassSession` | — |
| Registro de asistencia | `AttendanceRecord` | `PRESENT`, `ABSENT` |
| Configuración (una sola fila, `id = 1`) | `Settings` | — |
| Período vigente | `Settings.currentTermId` | puede ser `null` |
| Tamaño máximo de archivo | `Settings.maxFileSizeBytes` | por defecto 10485760 (10 MB) |
| Tipos de archivo permitidos | `Settings.allowedMimeTypes` | PDF, DOCX, ZIP, JPG y PNG |
| Registro de auditoría | `AuditLog` | — |

**Módulos de la API:** `auth`, `users`, `catalog` (oferta: carreras, materias, períodos y comisiones), `enrollments`, `classroom`, `grading`, `attendance`, `reports`.

## Reglas de negocio

### Usuarios y acceso

- **Una cuenta por legajo, un rol por cuenta.** Cada usuario tiene un solo rol, fijo. Si una persona tiene dos roles (por ejemplo, alumna y docente), tiene **dos cuentas**, cada una con su legajo y su contraseña. Para cambiar de rol se cierra la sesión y se entra con el otro legajo.
- **Legajo:** el prefijo del rol seguido **solo de dígitos**.

  | Rol | Prefijo | Ejemplo |
  |---|---|---|
  | `STUDENT` | `alu` | `alu12345` |
  | `TEACHER` | `doc` | `doc12345` |
  | `ADMIN` | `adm` | `adm12345` |
  | `DIRECTOR` | `dir` | `dir12345` |

  - Se guarda en minúscula. Al iniciar sesión se acepta en mayúsculas o en minúsculas: `ALU123` y `alu123` son el mismo legajo.
  - Es único en todo el sistema. Gracias al prefijo, el mismo número puede existir con roles distintos.
  - En el alta, el administrador elige el rol y escribe **solo el número**. El sistema arma el legajo con el prefijo, así el prefijo y el rol no pueden quedar distintos.
- **DNI:** obligatorio, 7 u 8 dígitos sin puntos. Es lo que relaciona las cuentas de una misma persona. Una persona tiene **a lo sumo una cuenta por rol**: no puede haber dos cuentas con el mismo DNI y el mismo rol.
- **Correo:** es solo un dato de contacto. Puede repetirse, porque las cuentas de una misma persona suelen compartirlo.
- **Altas:** solo el administrador da de alta usuarios. La contraseña temporal se genera al azar, se muestra una sola vez y se guarda solo su hash. El usuario queda con `mustChangePassword = true`.
- **El rol no se cambia.** No existe "asignar o quitar un rol": para darle otro rol a una persona se le crea otra cuenta.
- **Contraseñas:** toda contraseña nueva tiene al menos 8 caracteres y es distinta de la anterior.
- **Último administrador:** no se puede desactivar al último administrador activo.
- **Desactivar no borra datos.** Desactivar a un usuario conserva sus inscripciones, notas y asignaciones. Un docente desactivado ya no puede operar el aula.
- **Carreras del alumno:** un alumno tiene al menos una carrera. Quitarle una carrera no da de baja sus inscripciones.

### Oferta

- Una carrera o una materia inactiva no se ofrece para comisiones nuevas. Lo que ya se dictó se conserva.
- Cada materia pertenece a una sola carrera. Su código no se repite dentro de esa carrera.
- Una comisión tiene al menos un docente titular. Un docente no se asigna dos veces a la misma comisión.
- **No se asigna como docente a quien cursa la comisión:** no se puede asignar una cuenta docente si una cuenta de alumno **con el mismo DNI** tiene una inscripción en esa comisión.
- Al abrir una comisión se crea su aula.
- **Comisión cerrada:**
  - no admite inscripciones, entregas, publicaciones, actividades ni clases nuevas;
  - sí admite calificar, rectificar y corregir la asistencia;
  - no se reabre.

### Inscripción

- **Inscribirse:** la inscripción queda `ACTIVE` al instante si se cumple todo esto:
  - el alumno está activo;
  - la comisión está abierta y es del período vigente;
  - la materia pertenece a una de las carreras del alumno;
  - el alumno no tiene otra inscripción activa en la misma materia y el mismo período;
  - ninguna cuenta docente **con el mismo DNI** que el alumno está asignada a esa comisión;
  - no existe una inscripción previa del alumno en esa comisión.
- **Baja:** la puede hacer el alumno o el administrador.
- **Reactivación:** solo la hace el administrador. La comisión tiene que estar abierta y el alumno no puede tener otra inscripción activa en la misma materia y el mismo período.
- **Historial:** cada cambio de estado se registra en `EnrollmentStatusChange` y en la auditoría, con quién hizo el cambio.
- **Acceso al aula:** entran las inscripciones `ACTIVE` y `DROPPED`. Con `DROPPED` solo se puede consultar: no se puede entregar.

### Aula y actividades

- El material, los anuncios y las actividades se pueden editar mientras la comisión está abierta.
- Un archivo (`Attachment`) pertenece a exactamente uno de estos: un material, una actividad o una entrega.
- **Trabajo práctico (`ASSIGNMENT`):** tiene fecha límite, que debe ser futura al crearlo y puede quedar en el pasado al editarlo.
- **Evaluación (`ASSESSMENT`):** no tiene fecha límite ni entregas.
- **Cerrar una actividad** es definitivo. Después del cierre no se aceptan archivos nuevos, pero se puede seguir calificando.

### Entregas

- Hay una entrega por alumno y por actividad.
- La entrega es `ON_TIME` si su fecha es **menor o igual** a la fecha límite. Si no, es `LATE`, y se acepta igual.
- **Reemplazo:** el alumno puede reemplazar el archivo mientras la entrega no esté calificada.
  - La fecha de la entrega pasa a ser la del reemplazo y la presentación se vuelve a calcular.
  - Se conserva solo el archivo nuevo.
- Si cambia la fecha límite, la presentación de las entregas existentes no se vuelve a calcular.
- Una entrega calificada conserva su marca `LATE`.
- Un TP ya calificado, con entrega o sin ella, no admite entregas ni reemplazos.

### Calificaciones

- La nota es un entero de 1 a 10 y es obligatoria. Hay una calificación vigente por alumno y por actividad.
- **TP sin entrega:** se puede calificar a un alumno con inscripción activa aunque no haya entregado. La calificación queda con `withoutSubmission = true`.
- **Nota de aprobación (`passingGrade`):**
  - la define un docente de la comisión;
  - se puede cambiar mientras la comisión está abierta.
- **"Aprobada":** se calcula como `value >= passingGrade`. **No se guarda.** Si `passingGrade` es `null`, no se muestra.

### Asistencia

- Hay una clase por comisión y por fecha. La fecha no puede ser futura.
- **Al registrar una clase** se crea un registro por cada alumno que tenía la inscripción activa **en esa fecha**, según `EnrollmentStatusChange`. Todos empiezan en `PRESENT` y la clase se guarda completa.
- **Porcentaje:** presentes dividido registros. Si no hay registros, se muestra "sin registros". Se calcula al consultarlo y nunca se guarda.

### Planilla e historial

- Cada uno se calcula en **una única consulta**, independiente de la pantalla. Así los reportes y la exportación pueden usar la misma consulta.

### Auditoría

Estos cambios escriben un registro en `AuditLog`, **en la misma transacción** que el cambio:
- una nota o la nota de aprobación;
- el estado de una inscripción;
- el estado o las carreras de un usuario;
- el restablecimiento de una contraseña;
- cada corrección de asistencia.

Cada registro guarda quién hizo el cambio, la fecha, el objeto, el dato modificado, el valor anterior y el valor nuevo.
