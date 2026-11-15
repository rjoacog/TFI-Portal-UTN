import { RoleName, UserStatus } from '@prisma/client';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { SESSION_COOKIE_NAME, signToken } from '../../shared/auth/index.js';
import { prisma } from '../../shared/db/index.js';
import { createUser, resetDatabase } from '../../test/db.js';
import { hashPassword } from './password.service.js';

const SECRET = 'a'.repeat(32);
const PASSWORD = 'contraseña-correcta';
const LOGIN_LIMIT = { windowMs: 60_000, perLoginId: 5, perIp: 50 };

let passwordHash: string;
beforeAll(async () => {
  passwordHash = await hashPassword(PASSWORD);
});
beforeEach(resetDatabase);

const buildApp = (loginRateLimit = LOGIN_LIMIT) =>
  createApp({
    corsOrigins: ['http://localhost:5173'],
    jwtSecret: SECRET,
    loginRateLimit,
  });

/** Crea un usuario con contraseña conocida y sin cambio de contraseña pendiente. */
async function makeUser(options: Parameters<typeof createUser>[0] = {}, data = {}) {
  const user = await createUser(options);
  return prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false, ...data },
  });
}

const post = (app: ReturnType<typeof buildApp>, loginId: unknown, password: unknown) =>
  request(app).post('/api/auth/login').send({ loginId, password });

const cookiesOf = (res: request.Response) => res.headers['set-cookie'] as unknown as string[];

describe('POST /api/auth/login', () => {
  it('ingresa con legajo y contraseña correctos: cookie y datos del usuario', async () => {
    const user = await makeUser({ role: RoleName.TEACHER });

    const res = await post(buildApp(), user.loginId, PASSWORD);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: {
        id: user.id,
        loginId: user.loginId,
        role: 'TEACHER',
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        mustChangePassword: false,
      },
    });
    const cookie = cookiesOf(res)[0] ?? '';
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('normaliza el legajo: mayúsculas y espacios entran a la misma cuenta', async () => {
    const user = await makeUser({ loginId: 'alu123' });
    for (const loginId of ['ALU123', 'alu123', '  Alu123  ']) {
      const res = await post(buildApp(), loginId, PASSWORD);
      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(user.id);
    }
  });

  it('con mustChangePassword inicia sesión; la cookie sirve en /me', async () => {
    const user = await makeUser({}, { mustChangePassword: true });
    const app = buildApp();

    const res = await post(app, user.loginId, PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.user.mustChangePassword).toBe(true);

    const me = await request(app).get('/api/auth/me').set('Cookie', cookiesOf(res));
    expect(me.status).toBe(200);
    expect(me.body.user.mustChangePassword).toBe(true);
  });

  it('legajo inexistente y contraseña incorrecta dan exactamente la misma respuesta', async () => {
    const user = await makeUser();
    const app = buildApp();

    const missing = await post(app, 'alu99999', PASSWORD);
    const wrong = await post(app, user.loginId, 'otra-contraseña');

    expect(missing.status).toBe(401);
    expect(missing.body).toEqual({
      error: { code: 'INVALID_CREDENTIALS', message: 'Credenciales no válidas' },
    });
    expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual(missing.body);
    expect(missing.headers['set-cookie']).toBeUndefined();
    expect(wrong.headers['set-cookie']).toBeUndefined();
  });

  it('un legajo mal formado es simplemente inexistente (401, no 400)', async () => {
    const res = await post(buildApp(), 'xx-!!', PASSWORD);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('cuenta desactivada: 403 con la contraseña correcta, 401 con la incorrecta', async () => {
    const user = await makeUser({}, { status: UserStatus.DISABLED });
    const app = buildApp();

    const ok = await post(app, user.loginId, PASSWORD);
    expect(ok.status).toBe(403);
    expect(ok.body.error.code).toBe('ACCOUNT_DISABLED');
    expect(ok.headers['set-cookie']).toBeUndefined();

    const bad = await post(app, user.loginId, 'incorrecta');
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(bad.headers['set-cookie']).toBeUndefined();
  });

  it('falta loginId o password: 400 VALIDATION_ERROR', async () => {
    const app = buildApp();
    const bodies = [{ password: PASSWORD }, { loginId: 'alu1' }, { loginId: '', password: 'x' }];
    for (const body of bodies) {
      const res = await request(app).post('/api/auth/login').send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });
});

describe('límite de intentos', () => {
  it.each([['ALU777'], ['alu777']])(
    'tras 5 fallos seguidos rechaza aunque la contraseña sea correcta (%s)',
    async (loginId) => {
      await makeUser({ loginId: 'alu777' });
      const app = buildApp();
      for (let i = 0; i < 5; i += 1) {
        expect((await post(app, loginId, 'mala')).status).toBe(401);
      }

      const res = await post(app, loginId, PASSWORD);

      expect(res.status).toBe(429);
      expect(res.body).toEqual({
        error: {
          code: 'TOO_MANY_LOGIN_ATTEMPTS',
          message: 'Hiciste demasiados intentos fallidos. Esperá 15 minutos y volvé a intentar.',
        },
      });
      expect(res.headers['set-cookie']).toBeUndefined();
    },
  );

  it('cuenta juntos los intentos con mayúsculas, minúsculas y espacios', async () => {
    await makeUser({ loginId: 'alu778' });
    const app = buildApp();
    for (const id of ['ALU778', 'alu778', 'Alu778', ' alu778', 'ALU778']) {
      await post(app, id, 'mala');
    }
    expect((await post(app, 'alu778', PASSWORD)).status).toBe(429);
  });

  it('un ingreso correcto reinicia el contador del legajo', async () => {
    const user = await makeUser();
    const app = buildApp();
    for (let i = 0; i < 4; i += 1) await post(app, user.loginId, 'mala');
    expect((await post(app, user.loginId, PASSWORD)).status).toBe(200);
    for (let i = 0; i < 4; i += 1) {
      expect((await post(app, user.loginId, 'mala')).status).toBe(401);
    }
    expect((await post(app, user.loginId, PASSWORD)).status).toBe(200);
  });

  it('superado el límite por IP con legajos distintos, rechaza', async () => {
    const app = buildApp({ windowMs: 60_000, perLoginId: 100, perIp: 3 });
    for (let i = 0; i < 3; i += 1) {
      expect((await post(app, `alu9000${i}`, 'x')).status).toBe(401);
    }
    const res = await post(app, 'alu90009', 'x');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_LOGIN_ATTEMPTS');
  });
});

describe('POST /api/auth/logout', () => {
  const logout = (app: ReturnType<typeof buildApp>, cookies: string[]) =>
    request(app).post('/api/auth/logout').set('Cookie', cookies);

  it('responde 204, borra la cookie e incrementa tokenVersion en 1', async () => {
    const user = await makeUser();
    const app = buildApp();
    const session = await post(app, user.loginId, PASSWORD);

    const res = await logout(app, cookiesOf(session));

    expect(res.status).toBe(204);
    const cleared = cookiesOf(res)[0] ?? '';
    expect(cleared).toContain(`${SESSION_COOKIE_NAME}=;`);
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.tokenVersion).toBe(user.tokenVersion + 1);
  });

  it('con mustChangePassword también se puede cerrar sesión', async () => {
    const user = await makeUser({}, { mustChangePassword: true });
    const app = buildApp();
    const session = await post(app, user.loginId, PASSWORD);

    const res = await logout(app, cookiesOf(session));

    expect(res.status).toBe(204);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.tokenVersion).toBe(user.tokenVersion + 1);
  });

  it('rechaza usar la cookie anterior después de cerrar sesión: 401 UNAUTHENTICATED', async () => {
    const user = await makeUser();
    const app = buildApp();
    const session = await post(app, user.loginId, PASSWORD);
    const saved = cookiesOf(session);

    await logout(app, saved);
    const res = await request(app).get('/api/auth/me').set('Cookie', saved);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('cierra también la otra sesión de la misma cuenta: 401 UNAUTHENTICATED', async () => {
    const user = await makeUser();
    const app = buildApp();
    const first = await post(app, user.loginId, PASSWORD);
    const second = await post(app, user.loginId, PASSWORD);

    await logout(app, cookiesOf(first));
    const res = await request(app).get('/api/auth/me').set('Cookie', cookiesOf(second));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('sin sesión: 401 UNAUTHENTICATED', async () => {
    const res = await request(buildApp()).post('/api/auth/logout');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('Cache-Control de /api', () => {
  it('las respuestas llevan no-store, también las de error', async () => {
    const app = buildApp();
    const user = await makeUser();
    const ok = await post(app, user.loginId, PASSWORD);
    const unauthorized = await request(app).get('/api/auth/me');

    expect(ok.headers['cache-control']).toBe('no-store');
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers['cache-control']).toBe('no-store');
  });
});

describe('GET /api/auth/me', () => {
  it('devuelve los datos del usuario, sin passwordHash ni tokenVersion', async () => {
    const user = await makeUser();
    const app = buildApp();
    const login = await post(app, user.loginId, PASSWORD);

    const res = await request(app).get('/api/auth/me').set('Cookie', cookiesOf(login));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(login.body);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenVersion/);
  });

  it('sin cookie, con token inválido o con tokenVersion distinto: 401 UNAUTHENTICATED', async () => {
    const user = await makeUser();
    const app = buildApp();
    const stale = signToken({ sub: user.id, tv: user.tokenVersion + 1 }, SECRET);

    const cookies = [undefined, `${SESSION_COOKIE_NAME}=basura`, `${SESSION_COOKIE_NAME}=${stale}`];
    for (const cookie of cookies) {
      const req = request(app).get('/api/auth/me');
      const res = await (cookie ? req.set('Cookie', cookie) : req);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
  });
});
