import { RoleName } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { buildLegajo, dniSchema, isValidLegajo, legajoSchema, normalizeLegajo } from './index.js';

describe('buildLegajo', () => {
  it.each([
    [RoleName.TEACHER, '12345', 'doc12345'],
    [RoleName.STUDENT, '1', 'alu1'],
    [RoleName.ADMIN, 7, 'adm7'],
    [RoleName.DIRECTOR, '99', 'dir99'],
  ])('%s + %s da %s', (role, number, expected) => {
    expect(buildLegajo(role, number)).toBe(expected);
  });
});

describe('normalizeLegajo', () => {
  it('quita espacios en los extremos y pasa a minúscula', () => {
    expect(normalizeLegajo(' ALU123 ')).toBe('alu123');
  });
});

describe('isValidLegajo', () => {
  it('acepta el prefijo del rol seguido de dígitos', () => {
    expect(isValidLegajo('doc12345', RoleName.TEACHER)).toBe(true);
  });

  it.each([
    ['sin prefijo', '12345', RoleName.STUDENT],
    ['prefijo inexistente', 'xyz123', RoleName.STUDENT],
    ['letras en la parte numérica', 'alu12a3', RoleName.STUDENT],
    ['sin número', 'alu', RoleName.STUDENT],
    ['prefijo que no coincide con el rol', 'doc123', RoleName.STUDENT],
  ])('rechaza %s', (_caso, legajo, role) => {
    expect(isValidLegajo(legajo, role)).toBe(false);
  });
});

describe('legajoSchema', () => {
  it('normaliza y valida', () => {
    expect(legajoSchema(RoleName.STUDENT).parse(' ALU123 ')).toBe('alu123');
  });

  it('rechaza un prefijo que no coincide con el rol', () => {
    expect(legajoSchema(RoleName.STUDENT).safeParse('doc123').success).toBe(false);
  });
});

describe('dniSchema', () => {
  it.each(['1234567', '12345678'])('acepta %s', (dni) => {
    expect(dniSchema.safeParse(dni).success).toBe(true);
  });

  it.each([
    ['con puntos', '12.345.678'],
    ['con letras', '1234567a'],
    ['6 dígitos', '123456'],
    ['9 dígitos', '123456789'],
  ])('rechaza %s', (_caso, dni) => {
    expect(dniSchema.safeParse(dni).success).toBe(false);
  });
});
