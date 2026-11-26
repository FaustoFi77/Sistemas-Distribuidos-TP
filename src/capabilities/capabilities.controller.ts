import { Controller, Get } from '@nestjs/common';
import {
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';

export interface CapabilitiesResponse {
  apiVersion: '1';
  variants: string[];
}

export class CapabilitiesResponseDto implements CapabilitiesResponse {
  @ApiProperty({ enum: ['1'], example: '1' })
  apiVersion: '1';

  @ApiProperty({ type: [String], example: ['link-loss-zones'] })
  variants: string[];
}

@ApiTags('Capabilities')
@Controller('capabilities')
export class CapabilitiesController {
  @Public()
  @Get()
  @ApiOperation({
    summary: 'Anunciar versión de API y variantes soportadas por este backend',
  })
  @ApiResponse({
    status: 200,
    description: 'Versión y lista de variantes habilitadas',
    type: CapabilitiesResponseDto,
  })
  getCapabilities(): CapabilitiesResponse {
    return {
      apiVersion: '1',
      variants: ['link-loss-zones'],
    };
  }
}
