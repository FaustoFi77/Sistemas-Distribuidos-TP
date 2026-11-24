import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca una ruta o controller como pública (exenta del JwtAuthGuard global).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
