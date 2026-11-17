import { AuditObject, Prisma, RoleName, UserStatus } from '@prisma/client';
import { writeAudit } from '../../shared/audit/index.js';
import { prisma } from '../../shared/db/index.js';
import { AppError } from '../../shared/errors/index.js';
import { buildLegajo } from '../../shared/identity/index.js';
import { generateTemporaryPassword, setPassword } from '../auth/password.service.js';

export interface AdminUser {
  id: number;
  loginId: string;
  role: RoleName;
  dni: string;
  firstName: string;
  lastName: string;
  email: string;
  status: UserStatus;
  mustChangePassword: boolean;
  programs: { id: number; name: string }[];
}

const userSelect = {
  id: true,
  loginId: true,
  role: true,
  dni: true,
  firstName: true,
  lastName: true,
  email: true,
  status: true,
  mustChangePassword: true,
  programs: { select: { program: { select: { id: true, name: true } } } },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;

function toAdminUser(user: UserRow): AdminUser {
  return {
    id: user.id,
    loginId: user.loginId,
    role: user.role,
    dni: user.dni,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    programs: user.programs.map((row) => row.program),
  };
}

function programList(ids: number[]) {
  return [...ids].sort((a, b) => a - b).join(',');
}

async function requirePrograms(tx: Prisma.TransactionClient, programIds: number[]) {
  const unique = [...new Set(programIds)];
  if (unique.length === 0) {
    throw new AppError(400, 'PROGRAMS_REQUIRED', 'El alumno tiene que tener al menos una carrera');
  }
  const found = await tx.program.findMany({ where: { id: { in: unique } }, select: { id: true } });
  if (found.length !== unique.length) {
    throw new AppError(400, 'PROGRAM_NOT_FOUND', 'Una de las carreras no existe');
  }
  return unique;
}

export async function listUsers(): Promise<AdminUser[]> {
  const users = await prisma.user.findMany({ orderBy: { loginId: 'asc' }, select: userSelect });
  return users.map(toAdminUser);
}

export interface CreateUserInput {
  role: RoleName;
  legajoNumber: string;
  dni: string;
  firstName: string;
  lastName: string;
  email: string;
  programIds: number[];
}

/** Alta hecha por el administrador. La contraseña temporal se devuelve una sola vez. */
export async function createUser(actorId: number, input: CreateUserInput) {
  const loginId = buildLegajo(input.role, input.legajoNumber);
  const temporaryPassword = generateTemporaryPassword();

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          loginId,
          role: input.role,
          dni: input.dni,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          passwordHash: 'pending',
          mustChangePassword: true,
          status: UserStatus.ACTIVE,
        },
        select: { id: true },
      });
      await setPassword(tx, created.id, temporaryPassword, { mustChangePassword: true });

      if (input.role === RoleName.STUDENT) {
        const programIds = await requirePrograms(tx, input.programIds);
        await tx.studentProgram.createMany({
          data: programIds.map((programId) => ({ userId: created.id, programId })),
        });
        await writeAudit(tx, {
          actorId,
          objectType: AuditObject.USER,
          objectId: created.id,
          field: 'programs',
          previousValue: null,
          newValue: programList(programIds),
        });
      } else if (input.programIds.length > 0) {
        throw new AppError(400, 'PROGRAMS_NOT_ALLOWED', 'Solo el alumno tiene carreras');
      }

      return tx.user.findUniqueOrThrow({ where: { id: created.id }, select: userSelect });
    });
    return { user: toAdminUser(user), temporaryPassword };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = String(err.meta?.target ?? '');
      if (target.includes('dni')) {
        throw new AppError(409, 'DNI_ROLE_TAKEN', 'Ya existe una cuenta con ese DNI y ese rol');
      }
      throw new AppError(409, 'LOGIN_ID_TAKEN', 'Ya existe una cuenta con ese legajo');
    }
    throw err;
  }
}

export async function setUserStatus(actorId: number, userId: number, status: UserStatus) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'El recurso solicitado no existe');
    if (user.status === status) {
      const current = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: userSelect });
      return toAdminUser(current);
    }

    if (status === UserStatus.DISABLED && user.role === RoleName.ADMIN) {
      // Bloquea las filas de administradores activos para que dos bajas simultáneas no dejen cero.
      const activeAdmins = await tx.$queryRaw<{ id: number }[]>`
        SELECT id FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE' FOR UPDATE
      `;
      if (activeAdmins.filter((row) => row.id !== userId).length === 0) {
        throw new AppError(409, 'LAST_ADMIN', 'Tiene que quedar al menos un administrador activo');
      }
    }

    await tx.user.update({ where: { id: userId }, data: { status } });
    await writeAudit(tx, {
      actorId,
      objectType: AuditObject.USER,
      objectId: userId,
      field: 'status',
      previousValue: user.status,
      newValue: status,
    });
    const updated = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: userSelect });
    return toAdminUser(updated);
  });
}

/** Restablece la contraseña. La temporal se devuelve una sola vez y queda en la auditoría. */
export async function resetUserPassword(actorId: number, userId: number) {
  const temporaryPassword = generateTemporaryPassword();
  const user = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!existing) throw new AppError(404, 'NOT_FOUND', 'El recurso solicitado no existe');
    await setPassword(tx, userId, temporaryPassword, { mustChangePassword: true });
    await writeAudit(tx, {
      actorId,
      objectType: AuditObject.USER,
      objectId: userId,
      field: 'password',
      previousValue: null,
      newValue: 'temporary',
    });
    return tx.user.findUniqueOrThrow({ where: { id: userId }, select: userSelect });
  });
  return { user: toAdminUser(user), temporaryPassword };
}

export async function setStudentPrograms(actorId: number, userId: number, programIds: number[]) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, programs: { select: { programId: true } } },
    });
    if (!user) throw new AppError(404, 'NOT_FOUND', 'El recurso solicitado no existe');
    if (user.role !== RoleName.STUDENT) {
      throw new AppError(400, 'PROGRAMS_NOT_ALLOWED', 'Solo el alumno tiene carreras');
    }
    const next = await requirePrograms(tx, programIds);
    const previous = user.programs.map((row) => row.programId);
    await tx.studentProgram.deleteMany({ where: { userId } });
    await tx.studentProgram.createMany({
      data: next.map((programId) => ({ userId, programId })),
    });
    await writeAudit(tx, {
      actorId,
      objectType: AuditObject.USER,
      objectId: userId,
      field: 'programs',
      previousValue: programList(previous),
      newValue: programList(next),
    });
    const updated = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: userSelect });
    return toAdminUser(updated);
  });
}
