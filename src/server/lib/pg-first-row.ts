/** Normalize drizzle/postgres `execute` result to the first row object. */
export function firstExecuteRow(result: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(result) && result.length > 0) {
    return result[0] as Record<string, unknown>;
  }
  const rows = (result as { rows?: unknown[] })?.rows;
  if (Array.isArray(rows) && rows.length > 0) {
    return rows[0] as Record<string, unknown>;
  }
  return undefined;
}
