## Qué cambia

<!-- Resumen breve del cambio y, si no es obvio, por qué. -->

Closes #

## Cómo probarlo

<!-- Pasos para verificar el cambio a mano, si aplica. -->

## Lista de terminado

- [ ] Se cumplen todos los criterios de aceptación del issue, y cada uno tiene al menos una prueba.
- [ ] Hay una prueba de permisos: otro docente, otro alumno y un usuario sin el rol reciben el error que corresponde.
- [ ] Si el cambio toca algo auditable, escribe la auditoría en la misma transacción.
- [ ] No se borra nada que no corresponda (calificaciones, entregas, inscripciones, asistencia).
- [ ] Las fechas se guardan en UTC y se muestran en la hora de Argentina.
- [ ] La pantalla se puede usar en el ancho de un celular (si hay cambios de interfaz).
- [ ] Los mensajes de error explican qué pasó.
- [ ] Pasan `npm run lint`, `npm run typecheck`, `npm run test` y `npm run build`.
- [ ] Si hay migraciones, se conserva el SQL escrito a mano (índices parciales y restricciones `CHECK`).

## Notas

<!-- Decisiones tomadas, ambigüedades encontradas o lo que haya quedado pendiente. -->
