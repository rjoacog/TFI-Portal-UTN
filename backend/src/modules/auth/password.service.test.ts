import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/errors/index.js';
import { createUser, resetDatabase } from '../../test/db.js';
import {
  generateTemporaryPassword,
  hashPassword,
  setPassword,
  TEMPORARY_PASSWORD_ALPHABET,
  validateNewPassword,
  verifyPassword,
} from './password.service.js';

describe('hashPassword y verifyPassword', () => {
  it('hashea con argon2id', async () => {
    expect(await hashPassword('secreta123')).toMatch(/^\$argon2id\$/);
  });

  it('verifyPassword devuelve true con la contraseña correcta y false con una incorrecta', async () => {
    const hash = await hashPassword('secreta123');

    expect(await verifyPassword(hash, 'secreta123')).toBe(true);
    expect(await verifyPassword(hash, 'otra-cosa')).toBe(false);
  });

  it('verifyPassword devuelve false, sin lanzar, con un hash inválido', async () => {
    expect(await verifyPassword('no-es-un-hash', 'secreta123')).toBe(false);
  });
});

describe('validateNewPassword', () => {
  async function errorOf(promise: Promise<unknown>) {
    return promise.then(
      () => undefined,
      (err: unknown) => err,
    );
  }

  it('rechaza una contraseña de 7 caracteres con PASSWORD_TOO_SHORT', async () => {
    const error = await errorOf(validateNewPassword('1234567'));

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      status: 400,
      code: 'PASSWORD_TOO_SHORT',
      message: 'La contraseña tiene que tener al menos 8 caracteres',
    });
  });

  it('acepta una contraseña de 8 caracteres', async () => {
    await expect(validateNewPassword('12345678')).resolves.toBeUndefined();
  });

  it('acepta una contraseña distinta de la actual', async () => {
    const currentHash = await hashPassword('actual-123');
    await expect(validateNewPassword('nueva-456', currentHash)).resolves.toBeUndefined();
  });

  it('rechaza la misma contraseña que la actual con PASSWORD_REUSED', async () => {
    const currentHash = await hashPassword('actual-123');

    const error = await errorOf(validateNewPassword('actual-123', currentHash));

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      status: 400,
      code: 'PASSWORD_REUSED',
      message: 'La nueva contraseña tiene que ser distinta de la actual',
    });
  });
});

describe('setPassword', () => {
  beforeEach(resetDatabase);

  it('cambia el hash, fija mustChangePassword e incrementa tokenVersion en 1', async () => {
    const user = await createUser();
    expect(user.mustChangePassword).toBe(true);

    const tokenVersion = await prisma.$transaction((tx) =>
      setPassword(tx, user.id, 'nueva-clave', { mustChangePassword: false }),
    );

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(tokenVersion).toBe(user.tokenVersion + 1);
    expect(updated.tokenVersion).toBe(user.tokenVersion + 1);
    expect(updated.mustChangePassword).toBe(false);
    expect(updated.passwordHash).not.toBe(user.passwordHash);
    expect(await verifyPassword(updated.passwordHash, 'nueva-clave')).toBe(true);
  });

  it('puede volver a exigir el cambio de contraseña', async () => {
    const user = await createUser();
    await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });

    await prisma.$transaction((tx) =>
      setPassword(tx, user.id, 'temporal-1', { mustChangePassword: true }),
    );

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.mustChangePassword).toBe(true);
  });

  it('si la transacción falla, no cambia nada', async () => {
    const user = await createUser();

    const error = await prisma
      .$transaction(async (tx) => {
        await setPassword(tx, user.id, 'nueva-clave', { mustChangePassword: false });
        throw new Error('falla después de cambiar la contraseña');
      })
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(Error);
    const unchanged = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(unchanged).toMatchObject({
      passwordHash: user.passwordHash,
      mustChangePassword: user.mustChangePassword,
      tokenVersion: user.tokenVersion,
    });
  });
});

describe('generateTemporaryPassword', () => {
  it('genera 12 caracteres del alfabeto permitido, sin caracteres confusos', () => {
    const password = generateTemporaryPassword();

    expect(password).toHaveLength(12);
    for (const char of password) expect(TEMPORARY_PASSWORD_ALPHABET).toContain(char);
    expect(TEMPORARY_PASSWORD_ALPHABET).not.toMatch(/[0O1lI]/);
  });

  it('cumple la política de contraseñas', async () => {
    await expect(validateNewPassword(generateTemporaryPassword())).resolves.toBeUndefined();
  });

  it('no repite el valor en 1000 llamadas', () => {
    const passwords = Array.from({ length: 1000 }, generateTemporaryPassword);

    expect(new Set(passwords).size).toBe(1000);
    const allowed = new RegExp(`^[${TEMPORARY_PASSWORD_ALPHABET}]{12}$`);
    for (const password of passwords) expect(password).toMatch(allowed);
  });
});
