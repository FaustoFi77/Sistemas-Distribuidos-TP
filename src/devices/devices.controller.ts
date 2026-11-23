import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserResponse } from '../auth/dto/auth.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  PaginatedResponse,
  PaginationQueryDto,
} from '../common/dto/pagination.dto';
import { PetResponse } from '../pets/dto/pet.dto';
import { DevicesService } from './devices.service';
import {
  CreateEmbedTokenDto,
  CreatePairingCodeDto,
  DeviceResponse,
  EmbedTokenResponse,
  LinkDeviceDto,
  PairingCodeResponse,
} from './dto/device.dto';

@ApiTags('Devices & Pairing')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller()
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('pairing-codes')
  @ApiOperation({
    summary: 'Generar código de emparejamiento de un solo uso (vigente 10 min)',
  })
  @ApiResponse({ status: 201, description: 'Código generado en Ovenbird Cloud' })
  createPairingCode(
    @CurrentUser() user: UserResponse,
    @Body() dto: CreatePairingCodeDto,
  ): Promise<PairingCodeResponse> {
    return this.devicesService.createPairingCode(user.id, dto);
  }

  @Get('devices')
  @ApiOperation({
    summary:
      'Listar dispositivos del usuario (vinculados + recién emparejados en ventana de 10 min)',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada de dispositivos' })
  listDevices(
    @CurrentUser() user: UserResponse,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponse<DeviceResponse>> {
    return this.devicesService.listDevicesForUser(user.id, query);
  }

  @Put('pets/:petId/device')
  @ApiOperation({ summary: 'Vincular un dispositivo a una mascota (idempotente)' })
  @ApiResponse({ status: 200, description: 'Mascota actualizada con el dispositivo' })
  @ApiResponse({ status: 404, description: 'Mascota o dispositivo no encontrado' })
  @ApiResponse({ status: 409, description: 'Mascota o dispositivo ya vinculados' })
  linkDevice(
    @CurrentUser() user: UserResponse,
    @Param('petId') petId: string,
    @Body() dto: LinkDeviceDto,
  ): Promise<PetResponse> {
    return this.devicesService.linkDeviceToPet(user.id, petId, dto.deviceId);
  }

  @Delete('pets/:petId/device')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desvincular el dispositivo de una mascota' })
  @ApiResponse({ status: 204, description: 'Dispositivo desvinculado' })
  @ApiResponse({ status: 404, description: 'Mascota no encontrada' })
  unlinkDevice(
    @CurrentUser() user: UserResponse,
    @Param('petId') petId: string,
  ): Promise<void> {
    return this.devicesService.unlinkDeviceFromPet(user.id, petId);
  }

  @Post('embed-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Emitir token de corta duración para el mapa embebido (@ovenbird/react)',
  })
  @ApiResponse({ status: 200, description: 'Token de embebido emitido' })
<<<<<<< HEAD
  @ApiResponse({ status: 400, description: 'Datos inválidos (RFC 9457)' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Dispositivo no pertenece al usuario' })
  @ApiResponse({ status: 404, description: 'Mascota indicada en petId no encontrada' })
=======
  @ApiResponse({ status: 403, description: 'Dispositivo no pertenece al usuario' })
>>>>>>> e1320ea31da6df2bf4fa7967b6c9490a272bd2a9
  @ApiResponse({ status: 409, description: 'El usuario no tiene dispositivos vinculados' })
  createEmbedToken(
    @CurrentUser() user: UserResponse,
    @Body() dto: CreateEmbedTokenDto,
  ): Promise<EmbedTokenResponse> {
    return this.devicesService.createEmbedToken(user.id, dto);
  }
}
