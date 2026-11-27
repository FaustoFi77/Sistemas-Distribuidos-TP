import { QueryFailedError } from 'typeorm';
import { isUniqueConstraintError } from './db-error.utils';

describe('isUniqueConstraintError', () => {
  it('detecta violaciones UNIQUE por código, mensaje o QueryFailedError', () => {
    expect(isUniqueConstraintError({ code: 'SQLITE_CONSTRAINT_UNIQUE' })).toBe(
      true,
    );
    expect(isUniqueConstraintError({ code: 'SQLITE_CONSTRAINT' })).toBe(true);
    expect(isUniqueConstraintError({ code: '23505' })).toBe(true);
    expect(
      isUniqueConstraintError(
        new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: users.email'),
      ),
    ).toBe(true);
    expect(
      isUniqueConstraintError(
        new QueryFailedError(
          'INSERT INTO pets ...',
          [],
          Object.assign(new Error('UNIQUE constraint failed: pets.deviceId'), {
            code: 'SQLITE_CONSTRAINT_UNIQUE',
          }),
        ),
      ),
    ).toBe(true);
    expect(
      isUniqueConstraintError(
        new QueryFailedError(
          'INSERT INTO users ...',
          [],
          new Error('duplicate key value violates unique constraint'),
        ),
      ),
    ).toBe(true);
    expect(
      isUniqueConstraintError({
        driverError: { code: 'SQLITE_CONSTRAINT_UNIQUE' },
      }),
    ).toBe(true);
  });

  it('devuelve false para errores no relacionados o constraints distintas de UNIQUE', () => {
    expect(isUniqueConstraintError(null)).toBe(false);
    expect(isUniqueConstraintError(undefined)).toBe(false);
    expect(isUniqueConstraintError('UNIQUE constraint failed')).toBe(false);
    expect(
      isUniqueConstraintError(new Error('Database disk image malformed')),
    ).toBe(false);
    expect(
      isUniqueConstraintError({
        code: 'SQLITE_CONSTRAINT',
        message: 'FOREIGN KEY constraint failed',
      }),
    ).toBe(false);
    expect(
      isUniqueConstraintError({
        driverError: {
          code: 'SQLITE_CONSTRAINT',
          message: 'NOT NULL constraint failed: pets.name',
        },
      }),
    ).toBe(false);
  });
});
