import { ErrorCodes } from '../common/constants/error-codes';
import { HttpStatusCode } from '../common/constants/http-status';

export type DatabaseFaultInfo = {
  code: ErrorCodes.DATABASE_UNAVAILABLE;
  statusCode: HttpStatusCode.SERVICE_UNAVAILABLE;
  logLabel: string;
};

/** Postgres / network errors that mean "DB configured but unusable" — avoid opaque 500 for storefront. */
export function mapDatabaseFaultFromChain(err: unknown): DatabaseFaultInfo | null {
  const seen = new Set<unknown>();
  let current: unknown = err;
  for (let i = 0; i < 6 && current != null && !seen.has(current); i++) {
    seen.add(current);
    const hit = mapDatabaseFault(current);
    if (hit) return hit;
    if (typeof current === 'object' && current !== null && 'cause' in current) {
      current = (current as { cause: unknown }).cause;
    } else {
      break;
    }
  }
  return null;
}

function mapDatabaseFault(err: unknown): DatabaseFaultInfo | null {
  if (!err) return null;
  const e = (typeof err === 'object' ? err : {}) as { code?: unknown; message?: unknown; name?: unknown };
  const code = typeof e.code === 'string' ? e.code : '';
  const msg = typeof e.message === 'string' ? e.message : typeof err === 'string' ? err : '';
  const name = typeof e.name === 'string' ? e.name : '';

  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT' || code === 'ENETUNREACH') {
    return {
      code: ErrorCodes.DATABASE_UNAVAILABLE,
      statusCode: HttpStatusCode.SERVICE_UNAVAILABLE,
      logLabel: `network:${code}`,
    };
  }

  if (name === 'PostgresError' || /^[0-9]{2}[0-9P][0-9]{2}$/.test(code)) {
    return {
      code: ErrorCodes.DATABASE_UNAVAILABLE,
      statusCode: HttpStatusCode.SERVICE_UNAVAILABLE,
      logLabel: `postgres:${code || name}`,
    };
  }

  const lower = msg.toLowerCase();
  if (lower.includes('connect_timeout')) {
    return {
      code: ErrorCodes.DATABASE_UNAVAILABLE,
      statusCode: HttpStatusCode.SERVICE_UNAVAILABLE,
      logLabel: 'network:CONNECT_TIMEOUT',
    };
  }

  if (lower.includes('network connection lost')) {
    return {
      code: ErrorCodes.DATABASE_UNAVAILABLE,
      statusCode: HttpStatusCode.SERVICE_UNAVAILABLE,
      logLabel: 'network:connection_lost',
    };
  }

  if (
    lower.includes('enetunreach') ||
    lower.includes('network is unreachable')
  ) {
    return {
      code: ErrorCodes.DATABASE_UNAVAILABLE,
      statusCode: HttpStatusCode.SERVICE_UNAVAILABLE,
      logLabel: 'network:ENETUNREACH',
    };
  }

  if (
    lower.includes('too many subrequests by single worker invocation') ||
    lower.includes("worker's code had hung") ||
    lower.includes('would never generate a response')
  ) {
    return {
      code: ErrorCodes.DATABASE_UNAVAILABLE,
      statusCode: HttpStatusCode.SERVICE_UNAVAILABLE,
      logLabel: 'workers:runtime_limit',
    };
  }

  if (
    lower.includes('postgres') &&
    (lower.includes('connect') || lower.includes('econn') || lower.includes('timeout'))
  ) {
    return {
      code: ErrorCodes.DATABASE_UNAVAILABLE,
      statusCode: HttpStatusCode.SERVICE_UNAVAILABLE,
      logLabel: 'postgres:message',
    };
  }

  if (/relation\s+"[^"]+"\s+does\s+not\s+exist/i.test(msg)) {
    return {
      code: ErrorCodes.DATABASE_UNAVAILABLE,
      statusCode: HttpStatusCode.SERVICE_UNAVAILABLE,
      logLabel: 'postgres:undefined_table',
    };
  }

  return null;
}
