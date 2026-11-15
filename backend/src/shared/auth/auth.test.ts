import { RoleName, TeachingPosition, UserStatus } from '@prisma/client';
import cookieParser from 'cookie-parser';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../db/index.js';
import { errorHandler, notFoundHandler } from '../errors/index.js';
import { createUser, resetDatabase } from '../../test/db.js';
import {
  allowPasswordChangePending,
  assertTeachingAssignment,
  clearSessionCookie,
  createOriginCheck,
  createRequireAuth,
  requireRole,
  SESSION_COOKIE_NAME,
  setSessionCookie,
  signToken,
  type AuthUser,
} from './index.js';

const SECRET = 'a'.repeat(32);
const ALLOWED_ORIGIN = 'http://localhost:5173';

/** App mínima con una ruta de cada tipo para probar los middlewares. */
function buildApp() {
  const requireAuth = createRequireAuth(SECRET);
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(createOriginCheck([ALLOWED_ORIGIN]));

  app.get('/protected', requireAuth, (req, res) => {
    res.json({ user: req.user });
  });
  // Ruta marcada como permitida con `mustChangePassword` (en E1: cambio de contraseña y logout).
  app.post('/allowed', allowPasswordChangePending, requireAuth, (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/admin', requireAuth, requireRole(RoleName.ADMIN, RoleName.DIRECTOR), (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/sections/:id', requireAuth, async (req, res) => {
    await assertTeachingAssignment(req.user as AuthUser, Number(req.params.id));
    res.json({ ok: true });
  });
  app.post('/login-cookie', (_req, res) => {
    setSessionCookie(res, 'token', true);
    res.json({ ok: true });
  });
  app.post('/logout-cookie', (_req, res) => {
    clearSessionCookie(res, true);
    res.json({ ok: true });
  });
  app.post('/data', (_req, res) => {
    res.json({ ok: true });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

const cookieFor = (token: string) => `${SESSION_COOKIE_NAME}=${token}`;

/** Crea un usuario listo para usar (sin cambio de contraseña pendiente) y su token. */
async function login(options: Parameters<typeof createUser>[0] = {}) {
  const user = await createUser(options);
  await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });
  return { user, cookie: cookieFor(signToken({ sub: user.id, tv: user.tokenVersion }, SECRET)) };
}

beforeEach(resetDatabase);

describe('requireAuth', () => {
  it('un pedido válido pasa y deja id, role y mustChangePassword en el pedido', async () => {
    const { user, cookie } = await login({ role: RoleName.STUDENT });

    const res = await request(buildApp()).get('/protected').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: user.id,
      role: 'STUDENT',
      mustChangePassword: false,
    });
  });

  it('sin cookie responde 401 UNAUTHENTICATED', async () => {
    const res = await request(buildApp()).get('/protected');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('con un token inválido responde 401 UNAUTHENTICATED', async () => {
    const res = await request(buildApp()).get('/protected').set('Cookie', cookieFor('basura'));
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');

    // Firmado con otro secreto.
    const user = await createUser();
    const forged = signToken({ sub: user.id, tv: 0 }, 'b'.repeat(32));
    const res2 = await request(buildApp()).get('/protected').set('Cookie', cookieFor(forged));
    expect(res2.status).toBe(401);
  });

  it('con un token vencido responde 401 UNAUTHENTICATED', async () => {
    const user = await createUser();
    const expired = jwt.sign({ tv: 0 }, SECRET, {
      subject: String(user.id),
      expiresIn: -10,
    });

    const res = await request(buildApp()).get('/protected').set('Cookie', cookieFor(expired));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('con un tokenVersion distinto responde 401 UNAUTHENTICATED', async () => {
    const { user, cookie } = await login();
    await prisma.user.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } } });

    const res = await request(buildApp()).get('/protected').set('Cookie', cookie);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('con el usuario desactivado responde 401 UNAUTHENTICATED', async () => {
    const { user, cookie } = await login();
    await prisma.user.update({ where: { id: user.id }, data: { status: UserStatus.DISABLED } });

    const res = await request(buildApp()).get('/protected').set('Cookie', cookie);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('con un usuario inexistente responde 401 UNAUTHENTICATED', async () => {
    const token = signToken({ sub: 9999, tv: 0 }, SECRET);
    const res = await request(buildApp()).get('/protected').set('Cookie', cookieFor(token));
    expect(res.status).toBe(401);
  });
});

describe('mustChangePassword', () => {
  it('en una ruta común responde 403 PASSWORD_CHANGE_REQUIRED', async () => {
    const user = await createUser(); // mustChangePassword es true por defecto
    const cookie = cookieFor(signToken({ sub: user.id, tv: user.tokenVersion }, SECRET));

    const res = await request(buildApp()).get('/protected').set('Cookie', cookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('en una ruta permitida pasa', async () => {
    const user = await createUser();
    const cookie = cookieFor(signToken({ sub: user.id, tv: user.tokenVersion }, SECRET));

    const res = await request(buildApp())
      .post('/allowed')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
  });
});

describe('requireRole', () => {
  it('con un rol incorrecto responde 403 FORBIDDEN', async () => {
    const { cookie } = await login({ role: RoleName.STUDENT });

    const res = await request(buildApp()).get('/admin').set('Cookie', cookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('con alguno de los roles indicados pasa', async () => {
    const { cookie } = await login({ role: RoleName.DIRECTOR });

    const res = await request(buildApp()).get('/admin').set('Cookie', cookie);

    expect(res.status).toBe(200);
  });
});

describe('assertTeachingAssignment', () => {
  async function createSection() {
    const program = await prisma.program.create({
      data: { name: 'Tecnicatura', location: 'Sede' },
    });
    const subject = await prisma.subject.create({
      data: { programId: program.id, code: 'M1', name: 'Matemática' },
    });
    const term = await prisma.academicTerm.create({ data: { year: 2026, term: 1 } });
    return prisma.section.create({
      data: { subjectId: subject.id, termId: term.id, name: 'A' },
    });
  }

  it('un docente asignado a la comisión pasa', async () => {
    const section = await createSection();
    const { user, cookie } = await login({ role: RoleName.TEACHER });
    await prisma.teachingAssignment.create({
      data: { userId: user.id, sectionId: section.id, position: TeachingPosition.LEAD },
    });

    const res = await request(buildApp()).get(`/sections/${section.id}`).set('Cookie', cookie);

    expect(res.status).toBe(200);
  });

  it('un docente no asignado recibe 404 NOT_FOUND', async () => {
    const section = await createSection();
    const { cookie } = await login({ role: RoleName.TEACHER });

    const res = await request(buildApp()).get(`/sections/${section.id}`).set('Cookie', cookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('un usuario asignado pero sin el rol docente recibe 404 NOT_FOUND', async () => {
    const section = await createSection();
    const { user, cookie } = await login({ role: RoleName.STUDENT });
    await prisma.teachingAssignment.create({
      data: { userId: user.id, sectionId: section.id, position: TeachingPosition.ASSISTANT },
    });

    const res = await request(buildApp()).get(`/sections/${section.id}`).set('Cookie', cookie);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('control de Origin (CSRF)', () => {
  it.each(['post', 'put', 'patch', 'delete'] as const)(
    '%s con un Origin no permitido responde 403 FORBIDDEN_ORIGIN',
    async (method) => {
      const res = await request(buildApp())[method]('/data').set('Origin', 'http://malo.example');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_ORIGIN');
    },
  );

  it('un pedido que modifica datos sin Origin se acepta', async () => {
    const res = await request(buildApp()).post('/data');
    expect(res.status).toBe(200);
  });

  it('un pedido que modifica datos con un Origin permitido se acepta', async () => {
    const res = await request(buildApp()).post('/data').set('Origin', ALLOWED_ORIGIN);
    expect(res.status).toBe(200);
  });

  it('un GET con un Origin no permitido no se controla', async () => {
    const { cookie } = await login();
    const res = await request(buildApp())
      .get('/protected')
      .set('Origin', 'http://malo.example')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
  });
});

describe('token y cookie', () => {
  it('el token lleva sub y tv, y vence a las 8 horas', async () => {
    const decoded = jwt.verify(signToken({ sub: 7, tv: 3 }, SECRET), SECRET) as jwt.JwtPayload;

    expect(decoded.sub).toBe('7');
    expect(decoded.tv).toBe(3);
    expect((decoded.exp ?? 0) - (decoded.iat ?? 0)).toBe(8 * 60 * 60);
  });

  it('la cookie es httpOnly, SameSite=Lax, Secure si se pide, y dura 8 horas', async () => {
    const res = await request(buildApp()).post('/login-cookie');
    const setCookie = String(res.headers['set-cookie']);

    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=token`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('Max-Age=28800');
  });

  it('sin Secure la cookie no lo lleva', async () => {
    const app = express();
    app.get('/', (_req, res) => {
      setSessionCookie(res, 'token', false);
      res.end();
    });
    const res = await request(app).get('/');

    expect(String(res.headers['set-cookie'])).not.toContain('Secure');
  });

  it('borrar la cookie la vence', async () => {
    const res = await request(buildApp()).post('/logout-cookie');
    const setCookie = String(res.headers['set-cookie']);

    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=;`);
    expect(setCookie).toContain('Expires=Thu, 01 Jan 1970');
  });
});
