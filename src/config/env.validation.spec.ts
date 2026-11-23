import { validateEnv } from './env.validation';

describe('validateEnv (fail-fast al arrancar)', () => {
  const validConfig = {
    JWT_SECRET: 'una-clave-secreta-larga-y-segura-1234',
    OVENBIRD_CLIENT_ID: 'cid_test_123',
    OVENBIRD_CLIENT_SECRET: 'secret_test_456',
  };

  it('acepta configuración completa y válida', () => {
    expect(validateEnv(validConfig)).toEqual(validConfig);
  });

  it('falla al arrancar si falta JWT_SECRET', () => {
    expect(() =>
      validateEnv({
        OVENBIRD_CLIENT_ID: 'cid_test_123',
        OVENBIRD_CLIENT_SECRET: 'secret_test_456',
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('falla al arrancar si JWT_SECRET es demasiado corto', () => {
    expect(() =>
      validateEnv({
        ...validConfig,
        JWT_SECRET: 'corto',
      }),
    ).toThrow(/al menos 16 caracteres/);
  });

  it('falla al arrancar si faltan credenciales de Ovenbird', () => {
    expect(() =>
      validateEnv({
        JWT_SECRET: 'una-clave-secreta-larga-y-segura-1234',
      }),
    ).toThrow(/OVENBIRD_CLIENT_ID[\s\S]*OVENBIRD_CLIENT_SECRET/);
  });
});
