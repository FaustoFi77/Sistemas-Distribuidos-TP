import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  MessageEvent,
  Param,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtension,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserResponse } from '../auth/dto/auth.dto';
import { PaginatedResponse } from '../common/dto/pagination.dto';
import {
  AlertQueryDto,
  AlertResponse,
  PetMonitoringResponse,
} from './dto/zone.dto';
import { MonitoringService } from './monitoring.service';

@ApiTags('Alerts & Monitoring (link-loss-zones)')
@ApiBearerAuth('bearer')
@Controller()
export class AlertsController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('alerts')
  @ApiExtension('x-variant', 'link-loss-zones')
  @ApiOperation({
    summary:
      'Listar alertas de salida de zona y pérdida de enlace del usuario (paginado)',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada de alertas' })
  listAlerts(
    @CurrentUser() user: UserResponse,
    @Query() query: AlertQueryDto,
  ): Promise<PaginatedResponse<AlertResponse>> {
    return this.monitoringService.listAlertsForUser(user.id, query);
  }

  @Post('alerts/:alertId/acknowledge')
  @HttpCode(HttpStatus.OK)
  @ApiExtension('x-variant', 'link-loss-zones')
  @ApiOperation({ summary: 'Marcar una alerta como vista/reconocida' })
  @ApiResponse({ status: 200, description: 'Alerta reconocida' })
  @ApiResponse({ status: 404, description: 'Alerta no encontrada' })
  acknowledgeAlert(
    @CurrentUser() user: UserResponse,
    @Param('alertId') alertId: string,
  ): Promise<AlertResponse> {
    return this.monitoringService.acknowledgeAlert(user.id, alertId);
  }

  @Get('pets/:petId/monitoring')
  @ApiExtension('x-variant', 'link-loss-zones')
  @ApiOperation({
    summary:
      'Estado en vivo de enlace, última posición, evaluación de zonas y alertas activas de la mascota',
  })
  @ApiResponse({ status: 200, description: 'Estado actual de monitoreo' })
  @ApiResponse({ status: 404, description: 'Mascota no encontrada' })
  getPetMonitoring(
    @CurrentUser() user: UserResponse,
    @Param('petId') petId: string,
  ): Promise<PetMonitoringResponse> {
    return this.monitoringService.getPetMonitoringStatus(user.id, petId);
  }

  @Sse('alerts/stream')
  @ApiExtension('x-variant', 'link-loss-zones')
  @ApiOperation({
    summary:
      'Stream SSE en tiempo real de alertas y actualizaciones de monitoreo del usuario',
  })
  @ApiResponse({
    status: 200,
    description:
      'Conexión SSE abierta emitiendo eventos alert.created, alert.resolved y monitoring.updated',
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  streamAlerts(@CurrentUser() user: UserResponse): Observable<MessageEvent> {
    return this.monitoringService.streamEventsForUser(user.id);
  }
}
