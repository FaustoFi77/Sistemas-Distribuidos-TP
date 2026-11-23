import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtension,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserResponse } from '../auth/dto/auth.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaginatedResponse } from '../common/dto/pagination.dto';
import {
  CreateZoneDto,
  SafeZoneResponse,
  UpdateZoneDto,
  ZoneQueryDto,
} from './dto/zone.dto';
import { ZonesService } from './zones.service';

@ApiTags('Zones (link-loss-zones)')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller()
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Get('zones')
  @ApiExtension('x-variant', 'link-loss-zones')
  @ApiOperation({
    summary: 'Listar todas las zonas seguras del usuario (opcionalmente filtrar por petId)',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada de zonas circulares' })
  findAll(
    @CurrentUser() user: UserResponse,
    @Query() query: ZoneQueryDto,
  ): Promise<PaginatedResponse<SafeZoneResponse>> {
    return this.zonesService.findAllForUser(user.id, query);
  }

  @Get('pets/:petId/zones')
  @ApiExtension('x-variant', 'link-loss-zones')
  @ApiOperation({ summary: 'Listar zonas seguras de una mascota' })
  @ApiResponse({ status: 200, description: 'Lista de zonas circulares de la mascota' })
  @ApiResponse({ status: 404, description: 'Mascota no encontrada' })
  findAllForPet(
    @CurrentUser() user: UserResponse,
    @Param('petId') petId: string,
  ): Promise<SafeZoneResponse[]> {
    return this.zonesService.findAllForPet(user.id, petId);
  }

  @Post('pets/:petId/zones')
  @ApiExtension('x-variant', 'link-loss-zones')
  @ApiOperation({ summary: 'Crear una zona segura circular para una mascota' })
  @ApiResponse({ status: 201, description: 'Zona creada' })
  @ApiResponse({ status: 404, description: 'Mascota no encontrada' })
  createForPet(
    @CurrentUser() user: UserResponse,
    @Param('petId') petId: string,
    @Body() dto: CreateZoneDto,
  ): Promise<SafeZoneResponse> {
    return this.zonesService.createForPet(user.id, petId, dto);
  }

  @Patch('zones/:zoneId')
  @ApiExtension('x-variant', 'link-loss-zones')
  @ApiOperation({ summary: 'Actualizar una zona segura circular' })
  @ApiResponse({ status: 200, description: 'Zona actualizada' })
  @ApiResponse({ status: 404, description: 'Zona no encontrada' })
  update(
    @CurrentUser() user: UserResponse,
    @Param('zoneId') zoneId: string,
    @Body() dto: UpdateZoneDto,
  ): Promise<SafeZoneResponse> {
    return this.zonesService.update(user.id, zoneId, dto);
  }

  @Delete('zones/:zoneId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiExtension('x-variant', 'link-loss-zones')
  @ApiOperation({ summary: 'Eliminar una zona segura' })
  @ApiResponse({ status: 204, description: 'Zona eliminada' })
  @ApiResponse({ status: 404, description: 'Zona no encontrada' })
  remove(
    @CurrentUser() user: UserResponse,
    @Param('zoneId') zoneId: string,
  ): Promise<void> {
    return this.zonesService.remove(user.id, zoneId);
  }
}
