import { RoleName } from '@prisma/client';
import { Router } from 'express';
import { createRequireAuth, requireRole } from '../../shared/auth/index.js';
import { z } from '../../shared/validation/index.js';
import { getSectionSheet } from '../grading/grading.service.js';
import { getAcademicHistory } from '../history/history.service.js';

function csvCell(value: string | number | null) {
  const text = value === null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function sendCsv(res: import('express').Response, filename: string, rows: (string | number | null)[][]) {
  const body = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(`\uFEFF${body}`);
}

export function createReportsRouter({ jwtSecret }: { jwtSecret: string }) {
  const router = Router();
  const requireAuth = createRequireAuth(jwtSecret);
  const id = z.coerce.number().int().positive();

  router.get('/sections/:sectionId/sheet.csv', requireAuth, async (req, res) => {
    const sheet = await getSectionSheet(req.user!, id.parse(req.params.sectionId));
    const header = [
      'Legajo',
      'Apellido',
      'Nombre',
      'Inscripción',
      ...sheet.activities.flatMap((activity) => [
        `${activity.title} entrega`,
        `${activity.title} nota`,
        `${activity.title} observación`,
      ]),
      'Asistencia',
    ];
    const rows = sheet.rows.map((row) => [
      row.loginId,
      row.lastName,
      row.firstName,
      row.enrollmentStatus === 'ACTIVE' ? 'Activa' : 'Baja',
      ...row.cells.flatMap((cell) => [
        cell.submission === 'NONE'
          ? 'Sin entregar'
          : cell.submission === 'ON_TIME'
            ? 'A tiempo'
            : cell.submission === 'LATE'
              ? 'Tarde'
              : 'Calificada',
        cell.grade === null ? '' : cell.withoutSubmission ? `${cell.grade} (sin entrega)` : String(cell.grade),
        cell.observation,
      ]),
      row.attendance.label,
    ]);
    sendCsv(res, `planilla-comision-${sheet.section.id}.csv`, [header, ...rows]);
  });

  router.get('/history.csv', requireAuth, requireRole(RoleName.STUDENT), async (req, res) => {
    const history = await getAcademicHistory(req.user!);
    const rows: (string | number | null)[][] = [
      ['Materia', 'Comisión', 'Período', 'Inscripción', 'Actividad', 'Nota', 'Observación', 'Aprobada', 'Asistencia'],
    ];
    for (const item of history) {
      const period = `${item.term.year} C${item.term.term}`;
      const status = item.status === 'ACTIVE' ? 'Activa' : 'Baja';
      if (item.grades.length === 0) {
        rows.push([item.subject.name, item.section.name, period, status, '', '', '', '', item.attendance.label]);
      }
      for (const grade of item.grades) {
        rows.push([
          item.subject.name,
          item.section.name,
          period,
          status,
          grade.title,
          grade.withoutSubmission ? `${grade.value} (sin entrega)` : String(grade.value),
          grade.observation,
          grade.approved === null ? '' : grade.approved ? 'Sí' : 'No',
          item.attendance.label,
        ]);
      }
    }
    sendCsv(res, 'historial.csv', rows);
  });

  return router;
}
