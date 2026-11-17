import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RoleName } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { SESSION_COOKIE_NAME, signToken } from '../shared/auth/index.js';
import { clock } from '../shared/dates/index.js';
import { prisma } from '../shared/db/index.js';
import { LocalFileStorage } from '../shared/storage/index.js';
import { createUser, resetDatabase } from '../test/db.js';

const SECRET = 'a'.repeat(32);
const storageRoot = await mkdtemp(path.join(tmpdir(), 'utn-files-'));
const storage = new LocalFileStorage(storageRoot);
const app = createApp({ corsOrigins: ['http://localhost:5173'], jwtSecret: SECRET, storage });

afterAll(async () => {
  clock.reset();
  await rm(storageRoot, { recursive: true, force: true });
});

beforeEach(async () => {
  clock.reset();
  await resetDatabase();
});

async function cookieFor(role: RoleName, dni?: string) {
  const created = await createUser({ role, ...(dni ? { dni } : {}) });
  const user = await prisma.user.update({
    where: { id: created.id },
    data: { mustChangePassword: false },
  });
  const cookie = `${SESSION_COOKIE_NAME}=${signToken({ sub: user.id, tv: user.tokenVersion }, SECRET)}`;
  return { user, cookie };
}

async function academicBase() {
  const admin = await cookieFor(RoleName.ADMIN);
  const teacher = await cookieFor(RoleName.TEACHER);
  const student = await cookieFor(RoleName.STUDENT);
  const program = await prisma.program.create({ data: { name: 'Tecnicatura', location: 'Concepción' } });
  await prisma.studentProgram.create({ data: { userId: student.user.id, programId: program.id } });
  const subject = await prisma.subject.create({
    data: { programId: program.id, code: 'PROG1', name: 'Programación I' },
  });
  const term = await prisma.academicTerm.create({ data: { year: 2026, term: 1 } });
  await prisma.settings.update({ where: { id: 1 }, data: { currentTermId: term.id } });
  const opened = await request(app).post('/api/sections').set('Cookie', admin.cookie).send({
    subjectId: subject.id,
    termId: term.id,
    name: 'A',
    teachers: [{ userId: teacher.user.id, position: 'LEAD' }],
  });
  expect(opened.status).toBe(201);
  return { admin, teacher, student, subject, term, sectionId: opened.body.section.id as number };
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('administración de usuarios', () => {
  it('da de alta un alumno con contraseña temporal y no desactiva al último administrador', async () => {
    const admin = await cookieFor(RoleName.ADMIN);
    const program = await prisma.program.create({ data: { name: 'Tecnicatura', location: 'Concepción' } });

    const created = await request(app).post('/api/users').set('Cookie', admin.cookie).send({
      role: 'STUDENT',
      legajoNumber: '50',
      dni: '30999888',
      firstName: 'Ana',
      lastName: 'Paz',
      email: 'ana@test.local',
      programIds: [program.id],
    });

    expect(created.status).toBe(201);
    expect(created.body.user.loginId).toBe('alu50');
    expect(created.body.user.mustChangePassword).toBe(true);
    expect(created.body.temporaryPassword).toHaveLength(12);

    const blocked = await request(app)
      .patch(`/api/users/${admin.user.id}/status`)
      .set('Cookie', admin.cookie)
      .send({ status: 'DISABLED' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('LAST_ADMIN');
  });

  it('un alumno no administra usuarios', async () => {
    const student = await cookieFor(RoleName.STUDENT);
    const res = await request(app).get('/api/users').set('Cookie', student.cookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('oferta e inscripción', () => {
  it('inscribe al instante, impide otra activa en la materia y deja historial', async () => {
    const { student, sectionId, subject, term, admin, teacher } = await academicBase();
    const other = await request(app).post('/api/sections').set('Cookie', admin.cookie).send({
      subjectId: subject.id,
      termId: term.id,
      name: 'B',
      teachers: [{ userId: teacher.user.id, position: 'LEAD' }],
    });

    const enrolled = await request(app)
      .post(`/api/sections/${sectionId}/enrollments`)
      .set('Cookie', student.cookie);
    expect(enrolled.status).toBe(201);
    expect(enrolled.body.enrollment.status).toBe('ACTIVE');

    const duplicate = await request(app)
      .post(`/api/sections/${other.body.section.id}/enrollments`)
      .set('Cookie', student.cookie);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('ACTIVE_ENROLLMENT_EXISTS');
    expect(await prisma.enrollmentStatusChange.count()).toBe(1);
  });

  it('no deja que la misma persona sea docente y alumno de la comisión', async () => {
    const { student, sectionId } = await academicBase();
    const samePerson = await cookieFor(RoleName.TEACHER, student.user.dni);
    await prisma.teachingAssignment.create({
      data: { userId: samePerson.user.id, sectionId, position: 'ASSISTANT' },
    });

    const res = await request(app).post(`/api/sections/${sectionId}/enrollments`).set('Cookie', student.cookie);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TEACHER_AND_STUDENT');
  });

  it('el alumno se da de baja y solo el administrador reactiva', async () => {
    const { student, admin, sectionId } = await academicBase();
    const enrolled = await request(app).post(`/api/sections/${sectionId}/enrollments`).set('Cookie', student.cookie);
    const dropped = await request(app)
      .post(`/api/enrollments/${enrolled.body.enrollment.id}/drop`)
      .set('Cookie', student.cookie);
    expect(dropped.status).toBe(200);

    const self = await request(app)
      .post(`/api/enrollments/${enrolled.body.enrollment.id}/reactivate`)
      .set('Cookie', student.cookie);
    expect(self.status).toBe(403);

    const again = await request(app)
      .post(`/api/enrollments/${enrolled.body.enrollment.id}/reactivate`)
      .set('Cookie', admin.cookie);
    expect(again.status).toBe(200);
    expect(again.body.enrollment.status).toBe('ACTIVE');
  });
});

describe('aula, nota y asistencia', () => {
  it('publica, entrega tarde, califica y calcula la asistencia', async () => {
    clock.set(() => new Date('2026-11-01T15:00:00.000Z'));
    const { teacher, student, sectionId } = await academicBase();
    await request(app).post(`/api/sections/${sectionId}/enrollments`).set('Cookie', student.cookie);

    const announcement = await request(app)
      .post(`/api/sections/${sectionId}/announcements`)
      .set('Cookie', teacher.cookie)
      .send({ title: 'Bienvenida', body: 'Nos vemos el lunes' });
    expect(announcement.status).toBe(201);

    const activity = await request(app)
      .post(`/api/sections/${sectionId}/activities`)
      .set('Cookie', teacher.cookie)
      .field('type', 'ASSIGNMENT')
      .field('title', 'TP 1')
      .field('description', 'Resolver los ejercicios')
      .field('dueAt', '2026-11-20T23:00');
    expect(activity.status).toBe(201);

    clock.set(() => new Date('2026-11-21T15:00:00.000Z'));
    const submission = await request(app)
      .post(`/api/activities/${activity.body.activity.id}/submission`)
      .set('Cookie', student.cookie)
      .attach('file', PNG, 'entrega.png');
    expect(submission.status).toBe(200);
    expect(submission.body.submission.timeliness).toBe('LATE');

    const grade = await request(app)
      .put(`/api/activities/${activity.body.activity.id}/grade`)
      .set('Cookie', teacher.cookie)
      .send({ userId: student.user.id, value: 8, observation: 'Bien' });
    expect(grade.status).toBe(200);

    await request(app)
      .patch(`/api/sections/${sectionId}/passing-grade`)
      .set('Cookie', teacher.cookie)
      .send({ passingGrade: 6 });

    const classSession = await request(app)
      .post(`/api/sections/${sectionId}/classes`)
      .set('Cookie', teacher.cookie)
      .send({ date: '2026-11-21' });
    expect(classSession.status).toBe(201);
    expect(classSession.body.classSession.records[0].value).toBe('PRESENT');

    const history = await request(app).get('/api/history').set('Cookie', student.cookie);
    expect(history.status).toBe(200);
    expect(history.body.history[0].grades[0]).toMatchObject({ value: 8, approved: true });
    expect(history.body.history[0].attendance.label).toBe('100 %');

    const outsider = await cookieFor(RoleName.STUDENT);
    const hidden = await request(app).get(`/api/sections/${sectionId}/classroom`).set('Cookie', outsider.cookie);
    expect(hidden.status).toBe(404);
  });
});
