import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

export interface CapabilitiesResponse {
  apiVersion: '1';
  variants: string[];
}

@ApiTags('Capabilities')
@Controller('capabilities')
export class CapabilitiesController {
  @Get()
  @ApiOperation({
    summary: 'Anunciar versión de API y variantes soportadas por este backend',
  })
  @ApiResponse({
    status: 200,
    description: 'Versión y lista de variantes habilitadas',
  })
  getCapabilities(): CapabilitiesResponse {
    return {
      apiVersion: '1',
      variants: ['link-loss-zones'],
    };
  }
}
