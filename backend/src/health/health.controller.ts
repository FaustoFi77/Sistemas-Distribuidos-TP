import { Controller, Get } from '@nestjs/common';
import {
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';

export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

export class HealthResponseDto implements HealthResponse {
  @ApiProperty({ enum: ['ok'], example: 'ok' })
  status: 'ok';

  @ApiProperty({ example: '2026-06-01T12:00:00.000Z' })
  timestamp: string;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Public()
  @SkipThrottle()
  @Get()
  @ApiOperation({ summary: 'Verificar que el servidor backend está activo' })
  @ApiResponse({
    status: 200,
    description: 'Servidor operativo',
    type: HealthResponseDto,
  })
  check(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
