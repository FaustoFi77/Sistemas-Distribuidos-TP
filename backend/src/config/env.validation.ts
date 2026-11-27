export function parseFiniteEnvNumber(
  value: string | undefined,
  fallback: number,
  bounds?: { min?: number; max?: number },
): number {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  const parsed = trimmed === '' ? fallback : Number(trimmed);
  let result = Number.isFinite(parsed) ? parsed : fallback;
  if (bounds?.min !== undefined && result < bounds.min) {
    result = bounds.min;
  }
  if (bounds?.max !== undefined && result > bounds.max) {
    result = bounds.max;
  }
  return result;
}

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const errors: string[] = [];

  const jwtSecret =
    typeof config.JWT_SECRET === 'string' ? config.JWT_SECRET.trim() : '';
  if (!jwtSecret) {
    errors.push('JWT_SECRET es obligatoria y no puede estar vacía.');
  } else if (Buffer.byteLength(jwtSecret, 'utf8') < 32) {
    errors.push(
      'JWT_SECRET debe tener al menos 32 bytes para firmar HS256 de forma segura.',
    );
  }

  const clientId =
    typeof config.OVENBIRD_CLIENT_ID === 'string'
      ? config.OVENBIRD_CLIENT_ID.trim()
      : '';
  if (!clientId) {
    errors.push('OVENBIRD_CLIENT_ID es obligatoria y no puede estar vacía.');
  }

  const clientSecret =
    typeof config.OVENBIRD_CLIENT_SECRET === 'string'
      ? config.OVENBIRD_CLIENT_SECRET.trim()
      : '';
  if (!clientSecret) {
    errors.push(
      'OVENBIRD_CLIENT_SECRET es obligatoria y no puede estar vacía.',
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Error en variables de entorno requeridas:\n- ${errors.join('\n- ')}`,
    );
  }

  return config;
}
