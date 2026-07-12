import { and, desc, eq, sql } from 'drizzle-orm';
import type { Database } from './client';
import { UserRole } from '../common/constants/roles.enum';
import { leads, users, type UserInsert, type UserRow } from './schema';

export async function insertUser(db: Database, data: UserInsert): Promise<UserRow> {
  const [row] = await db.insert(users).values(data).returning();
  if (!row) {
    throw new Error('Failed to create user');
  }
  return row;
}

export async function findUserByEmail(db: Database, email: string): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row ?? null;
}

export async function findUserById(db: Database, id: string): Promise<UserRow | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

export async function listUsersByRole(db: Database, role: UserRole): Promise<UserRow[]> {
  /** Compare as text so we match the DB even if Drizzle/pgEnum binding differs for newer enum values. */
  return db
    .select()
    .from(users)
    .where(sql`${users.role}::text = ${role}`);
}

export async function listAllUsers(db: Database): Promise<UserRow[]> {
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function countUsersByRole(db: Database, role: UserRole): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(users)
    .where(sql`${users.role}::text = ${role}`);
  return row?.c ?? 0;
}

/** Users with role ADMIN and isActive true — for last-admin safeguards. */
export async function countActiveAdmins(db: Database): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.isActive, true), sql`${users.role}::text = ${UserRole.ADMIN}`));
  return row?.c ?? 0;
}

export async function countLeadsCreatedByUser(db: Database, userId: string): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(leads)
    .where(eq(leads.createdByUserId, userId));
  return row?.c ?? 0;
}

export async function deleteUserById(db: Database, id: string): Promise<boolean> {
  const [r] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
  return r != null;
}

export async function findUserByEmailVerifyToken(
  db: Database,
  token: string,
): Promise<UserRow | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.emailVerifyToken, token))
    .limit(1);
  return row ?? null;
}

export async function findUserByPasswordResetToken(
  db: Database,
  token: string,
): Promise<UserRow | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.passwordResetToken, token))
    .limit(1);
  return row ?? null;
}

export type UserPatch = Partial<
  Pick<
    UserRow,
    | 'name'
    | 'email'
    | 'password'
    | 'role'
    | 'isActive'
    | 'refreshToken'
    | 'emailVerified'
    | 'emailVerifyToken'
    | 'emailVerifyExpiresAt'
    | 'passwordResetToken'
    | 'passwordResetExpiresAt'
  >
>;

export async function updateUserById(
  db: Database,
  id: string,
  patch: UserPatch,
): Promise<UserRow | null> {
  const [row] = await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return row ?? null;
}
