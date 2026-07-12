import { ErrorCodes } from '../common/constants/error-codes';
import { HttpStatusCode } from '../common/constants/http-status';
import { UserRole } from '../common/constants/roles.enum';
import type { Database } from '../db/client';
import * as usersRepo from '../db/users.repo';
import type { UserRow } from '../db/schema';
import { AppError } from '../lib/app-error';
import { ensureSalesmanEnumValue } from '../lib/ensure-salesman-enum';
import { hashPassword } from '../lib/password';

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  isActive?: boolean;
  /** Defaults to false for API signups; set true for seeded admins. */
  emailVerified?: boolean;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
}

export async function createUser(db: Database, input: CreateUserInput): Promise<UserRow> {
  const email = input.email.trim().toLowerCase();
  const existing = await usersRepo.findUserByEmail(db, email);
  if (existing) {
    throw new AppError(ErrorCodes.USER_ALREADY_EXISTS, HttpStatusCode.CONFLICT);
  }

  const role = input.role ?? UserRole.USER;
  if (role === UserRole.SALESMAN) {
    await ensureSalesmanEnumValue(db);
  }

  const hashedPassword = await hashPassword(input.password);

  return usersRepo.insertUser(db, {
    name: input.name.trim(),
    email,
    password: hashedPassword,
    role,
    isActive: input.isActive ?? true,
    emailVerified: input.emailVerified ?? false,
  });
}

export async function findByEmail(db: Database, email: string): Promise<UserRow | null> {
  return usersRepo.findUserByEmail(db, email.trim().toLowerCase());
}

export async function findById(db: Database, id: string): Promise<UserRow | null> {
  return usersRepo.findUserById(db, id);
}

export async function updateUser(
  db: Database,
  id: string,
  dto: UpdateUserInput,
): Promise<UserRow> {
  const current = await findById(db, id);
  if (!current) {
    throw new AppError(ErrorCodes.USER_NOT_FOUND, HttpStatusCode.NOT_FOUND);
  }

  const nextRole = dto.role ?? current.role;
  const nextActive = dto.isActive ?? current.isActive;
  if (current.role === UserRole.ADMIN && current.isActive) {
    const willStayActiveAdmin = nextRole === UserRole.ADMIN && nextActive === true;
    if (!willStayActiveAdmin) {
      const activeAdmins = await usersRepo.countActiveAdmins(db);
      if (activeAdmins <= 1) {
        throw new AppError(
          ErrorCodes.USER_DELETE_BLOCKED,
          HttpStatusCode.BAD_REQUEST,
          'Cannot demote or deactivate the last administrator.',
        );
      }
    }
  }

  if (dto.role === UserRole.SALESMAN) {
    await ensureSalesmanEnumValue(db);
  }

  const patch: usersRepo.UserPatch = {};

  if (dto.name !== undefined) {
    patch.name = dto.name;
  }
  if (dto.email !== undefined) {
    patch.email = dto.email.trim().toLowerCase();
  }
  if (dto.password !== undefined) {
    patch.password = await hashPassword(dto.password);
  }
  if (dto.role !== undefined) {
    patch.role = dto.role;
  }
  if (dto.isActive !== undefined) {
    patch.isActive = dto.isActive;
  }

  const updated = await usersRepo.updateUserById(db, id, patch);
  if (!updated) {
    throw new AppError(ErrorCodes.USER_NOT_FOUND, HttpStatusCode.NOT_FOUND);
  }
  return updated;
}

export async function deleteUserAsAdmin(
  db: Database,
  targetId: string,
  actorId: string,
): Promise<void> {
  if (targetId === actorId) {
    throw new AppError(
      ErrorCodes.USER_DELETE_BLOCKED,
      HttpStatusCode.BAD_REQUEST,
      'You cannot delete your own account.',
    );
  }
  const target = await findById(db, targetId);
  if (!target) {
    throw new AppError(ErrorCodes.USER_NOT_FOUND, HttpStatusCode.NOT_FOUND);
  }
  if (target.role === UserRole.ADMIN) {
    const adminCount = await usersRepo.countUsersByRole(db, UserRole.ADMIN);
    if (adminCount <= 1) {
      throw new AppError(
        ErrorCodes.USER_DELETE_BLOCKED,
        HttpStatusCode.BAD_REQUEST,
        'Cannot delete the last admin account.',
      );
    }
  }
  const leadsN = await usersRepo.countLeadsCreatedByUser(db, targetId);
  if (leadsN > 0) {
    throw new AppError(
      ErrorCodes.USER_DELETE_BLOCKED,
      HttpStatusCode.BAD_REQUEST,
      'Cannot delete this user because they created one or more leads. Reassign or remove those leads first.',
    );
  }
  const deleted = await usersRepo.deleteUserById(db, targetId);
  if (!deleted) {
    throw new AppError(ErrorCodes.USER_NOT_FOUND, HttpStatusCode.NOT_FOUND);
  }
}

export async function setRefreshTokenHash(
  db: Database,
  userId: string,
  hashedRefresh: string | null,
): Promise<void> {
  await usersRepo.updateUserById(db, userId, { refreshToken: hashedRefresh });
}
