import type { UserRole } from '../common/constants/roles.enum';
import type { UserRow } from '../db/schema';

/** Fields safe to return to the browser (no secrets or token hashes). */
export type SafePublicUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function toPublicUser(row: UserRow | null): SafePublicUser | null {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
    isActive: row.isActive,
    emailVerified: row.emailVerified,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
