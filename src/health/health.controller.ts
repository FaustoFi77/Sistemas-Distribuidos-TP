import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Public()
  @SkipThrottle()
  @Get()
  @ApiOperation({ summary: 'Verificar que el servidor backend está activo' })
  @ApiResponse({ status: 200, description: 'Servidor operativo' })
  check(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
