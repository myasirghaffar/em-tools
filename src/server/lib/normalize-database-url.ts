/** Normalize connection string (quotes, SSL for Supabase hosts). */
export function normalizeDatabaseUrl(raw: string): string {
  let u = raw.trim().replace(/^["']|["']$/g, '');
  if (/supabase\.(co|com)/i.test(u) && !/sslmode=/i.test(u)) {
    u += u.includes('?') ? '&sslmode=require' : '?sslmode=require';
  }
  return u;
}
