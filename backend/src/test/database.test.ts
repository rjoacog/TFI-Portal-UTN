import { Prisma, RoleName } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../shared/db/index.js';
import { createUser, resetDatabase } from './db.js';
import { getTestDatabaseUrl, TestDatabaseConfigError } from './test-database-url.js';

const VALID_URL = 'postgresql://u:p@localhost:5432/utn_connect?schema=test';

describe('getTestDatabaseUrl', () => {
  it('devuelve la URL si indica schema=test', () => {
    expect(getTestDatabaseUrl({ DATABASE_URL_TEST: VALID_URL })).toBe(VALID_URL);
  });

  it.each([
    ['falta', undefined, /falta la variable `DATABASE_URL_TEST`/],
    ['está vacía', '  ', /falta la variable/],
    ['no es una URL', 'no-es-una-url', /no es una URL válida/],
    ['no es de PostgreSQL', 'mysql://u:p@localhost/utn_connect?schema=test', /PostgreSQL/],
    ['no indica el esquema', 'postgresql://u:p@localhost:5432/utn_connect', /schema=test/],
    [
      'indica otro esquema',
      'postgresql://u:p@localhost:5432/utn_connect?schema=public',
      /schema=test/,
    ],
  ])('lanza un error con instrucciones si %s', (_caso, value, message) => {
    const call = () => getTestDatabaseUrl({ DATABASE_URL_TEST: value });
    expect(call).toThrow(TestDatabaseConfigError);
    expect(call).toThrow(message);
    expect(call).toThrow(/Agregá `DATABASE_URL_TEST` a `backend\/\.env`/);
  });
});

describe('base de pruebas', () => {
  beforeEach(resetDatabase);

  it('usa el esquema test', async () => {
    const [row] = await prisma.$queryRaw<{ schema: string }[]>`SELECT current_schema() AS schema`;
    expect(row?.schema).toBe('test');
  });

  it('rechaza un segundo usuario con el mismo loginId', async () => {
    await createUser({ loginId: 'alu12345', role: RoleName.STUDENT });

    const error = await createUser({ loginId: 'alu12345' }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
  });

  it('createUser crea una sola cuenta con el legajo del rol y un DNI', async () => {
    const user = await createUser({ role: RoleName.TEACHER });
    expect(user.role).toBe(RoleName.TEACHER);
    expect(user.loginId).toMatch(/^doc\d+$/);
    expect(user.dni).toMatch(/^\d{8}$/);
  });

  it('rechaza una segunda cuenta con el mismo DNI y el mismo rol', async () => {
    await createUser({ role: RoleName.STUDENT, dni: '12345678' });

    const error = await createUser({ role: RoleName.STUDENT, dni: '12345678' }).catch(
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((error as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
  });

  it('acepta el mismo DNI con otro rol y un correo repetido', async () => {
    await createUser({ role: RoleName.STUDENT, dni: '12345678', email: 'persona@test.local' });

    const teacher = await createUser({
      role: RoleName.TEACHER,
      dni: '12345678',
      email: 'persona@test.local',
    });

    expect(teacher.role).toBe(RoleName.TEACHER);
    expect(await prisma.user.count()).toBe(2);
  });
});

describe('resetDatabase', () => {
  it('vacía las tablas, salvo settings, y restaura settings', async () => {
    const term = await prisma.academicTerm.create({ data: { year: 2026, term: 1 } });
    await prisma.settings.update({
      where: { id: 1 },
      data: { currentTermId: term.id, maxFileSizeBytes: 1, allowedMimeTypes: ['text/plain'] },
    });
    const program = await prisma.program.create({
      data: { name: 'Tecnicatura', location: 'Sede' },
    });
    await prisma.subject.create({
      data: { programId: program.id, code: 'M1', name: 'Matemática' },
    });
    await createUser({ role: RoleName.STUDENT });

    await resetDatabase();

    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.program.count()).toBe(0);
    expect(await prisma.subject.count()).toBe(0);
    expect(await prisma.academicTerm.count()).toBe(0);

    const settings = await prisma.settings.findMany();
    expect(settings).toHaveLength(1);
    expect(settings[0]).toMatchObject({
      id: 1,
      currentTermId: null,
      maxFileSizeBytes: 10485760,
      allowedMimeTypes: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/zip',
        'image/jpeg',
        'image/png',
      ],
    });

    // Los identificadores vuelven a empezar en 1.
    const user = await createUser();
    expect(user.id).toBe(1);
  });
});
