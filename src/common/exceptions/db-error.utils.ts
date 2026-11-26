import { QueryFailedError } from 'typeorm';

const UNIQUE_ERROR_CODES = new Set([
  'SQLITE_CONSTRAINT_UNIQUE',
  'SQLITE_CONSTRAINT',
  '23505',
]);

export function isUniqueConstraintError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) {
    return false;
  }

  const record = err as {
    code?: unknown;
    message?: unknown;
    driverError?: { code?: unknown; message?: unknown };
  };

  const rawMessage =
    typeof record.message === 'string'
      ? record.message
      : typeof record.driverError?.message === 'string'
        ? record.driverError.message
        : '';

  if (rawMessage.includes('UNIQUE constraint failed')) {
    return true;
  }

  if (
    rawMessage.includes('FOREIGN KEY constraint failed') ||
    rawMessage.includes('NOT NULL constraint failed')
  ) {
    return false;
  }

  const code =
    typeof record.code === 'string'
      ? record.code
      : typeof record.driverError?.code === 'string'
        ? record.driverError.code
        : undefined;

  if (code && UNIQUE_ERROR_CODES.has(code)) {
    return true;
  }

  if (
    err instanceof QueryFailedError &&
    rawMessage.toUpperCase().includes('UNIQUE')
  ) {
    return true;
  }

  return false;
}
