import { RoleName } from '@prisma/client';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { SESSION_COOKIE_NAME, signToken } from '../../shared/auth/index.js';
import { prisma } from '../../shared/db/index.js';
import { createUser, resetDatabase } from '../../test/db.js';

const SECRET = 'a'.repeat(32);
beforeEach(resetDatabase);

const app = () => createApp({ corsOrigins: ['http://localhost:5173'], jwtSecret: SECRET });

/** Crea un usuario sin cambio de contraseña pendiente y la cookie de su sesión. */
async function session(
  role: RoleName = RoleName.STUDENT,
  data: { mustChangePassword?: boolean } = {},
) {
  const created = await createUser({ role });
  const user = await prisma.user.update({
    where: { id: created.id },
    data: { mustChangePassword: false, ...data },
  });
  const cookie = `${SESSION_COOKIE_NAME}=${signToken({ sub: user.id, tv: user.tokenVersion }, SECRET)}`;
  return { user, cookie };
}

const patch = (cookie: string, body: unknown) =>
  request(app())
    .patch('/api/users/me')
    .set('Cookie', cookie)
    .send(body as object);

describe('GET /api/users/me', () => {
  it('devuelve los datos del perfil', async () => {
    const { user, cookie } = await session();

    const res = await request(app()).get('/api/users/me').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: {
        loginId: user.loginId,
        role: user.role,
        dni: user.dni,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    });
  });
});

describe('PATCH /api/users/me', () => {
  it.each(Object.values(RoleName))('modifica nombre y apellido (%s)', async (role) => {
    const { user, cookie } = await session(role);

    const res = await patch(cookie, { firstName: 'Ana', lastName: 'Pérez' });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      loginId: user.loginId,
      firstName: 'Ana',
      lastName: 'Pérez',
    });
    const me = await request(app()).get('/api/auth/me').set('Cookie', cookie);
    expect(me.body.user).toMatchObject({ firstName: 'Ana', lastName: 'Pérez' });
  });

  it('guarda sin espacios en los extremos', async () => {
    const { user, cookie } = await session();

    const res = await patch(cookie, { firstName: '  Ana  ', lastName: '\tPérez ' });

    expect(res.status).toBe(200);
    const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(saved.firstName).toBe('Ana');
    expect(saved.lastName).toBe('Pérez');
  });

  it.each([
    ['firstName', ''],
    ['firstName', '   '],
    ['lastName', ''],
    ['lastName', '   '],
    ['firstName', 'a'.repeat(101)],
    ['lastName', 'a'.repeat(101)],
  ])('rechaza %s = %j: 400 VALIDATION_ERROR con el campo', async (field, value) => {
    const { cookie } = await session();
    const body = { firstName: 'Ana', lastName: 'Pérez', [field]: value };

    const res = await patch(cookie, body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toContain(field);
  });

  it('acepta exactamente 100 caracteres', async () => {
    const { cookie } = await session();
    const res = await patch(cookie, { firstName: 'a'.repeat(100), lastName: 'b' });
    expect(res.status).toBe(200);
  });

  it.each(['loginId', 'dni', 'email', 'role'])(
    'rechaza enviar %s: 400 VALIDATION_ERROR y no cambia nada',
    async (field) => {
      const { user, cookie } = await session();

      const res = await patch(cookie, { firstName: 'Ana', lastName: 'Pérez', [field]: 'ADMIN' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      const saved = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(saved).toMatchObject({
        loginId: user.loginId,
        dni: user.dni,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      });
    },
  );

  it('solo edita el perfil de la sesión: no recibe un id', async () => {
    const mine = await session();
    const other = await session();

    await patch(mine.cookie, { firstName: 'Ana', lastName: 'Pérez' });

    const untouched = await prisma.user.findUniqueOrThrow({ where: { id: other.user.id } });
    expect(untouched.firstName).toBe(other.user.firstName);
  });
});

describe.each([
  ['GET', (a: ReturnType<typeof app>) => request(a).get('/api/users/me')],
  [
    'PATCH',
    (a: ReturnType<typeof app>) =>
      request(a).patch('/api/users/me').send({ firstName: 'Ana', lastName: 'Pérez' }),
  ],
])('permisos de %s /api/users/me', (_method, build) => {
  it('sin sesión: 401 UNAUTHENTICATED', async () => {
    const res = await build(app());
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('con mustChangePassword: 403 PASSWORD_CHANGE_REQUIRED', async () => {
    const { cookie } = await session(RoleName.STUDENT, { mustChangePassword: true });
    const res = await build(app()).set('Cookie', cookie);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });
});
