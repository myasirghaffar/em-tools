export type UserRole = "admin" | "user" | "salesman";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  phone?: string;
  city?: string;
  emailVerified?: boolean;
}
