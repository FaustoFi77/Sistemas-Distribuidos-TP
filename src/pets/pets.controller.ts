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
import { CreatePetDto, PetResponse, UpdatePetDto } from './dto/pet.dto';
import { PetsService } from './pets.service';

@ApiTags('Pets')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar mascotas del usuario autenticado (paginado)' })
  @ApiResponse({ status: 200, description: 'Lista paginada de mascotas' })
  findAll(
    @CurrentUser() user: UserResponse,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponse<PetResponse>> {
    return this.petsService.findAllForUser(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una nueva mascota' })
  @ApiResponse({ status: 201, description: 'Mascota creada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos (RFC 9457)' })
  create(
    @CurrentUser() user: UserResponse,
    @Body() dto: CreatePetDto,
  ): Promise<PetResponse> {
    return this.petsService.create(user.id, dto);
  }

  @Get(':petId')
  @ApiOperation({ summary: 'Obtener detalle de una mascota del usuario' })
  @ApiResponse({ status: 200, description: 'Detalle de la mascota' })
  @ApiResponse({ status: 404, description: 'Mascota no encontrada' })
  findOne(
    @CurrentUser() user: UserResponse,
    @Param('petId') petId: string,
  ): Promise<PetResponse> {
    return this.petsService.findOneForUser(user.id, petId);
  }

  @Patch(':petId')
  @ApiOperation({ summary: 'Actualizar parcialmente una mascota' })
  @ApiResponse({ status: 200, description: 'Mascota actualizada' })
  @ApiResponse({ status: 404, description: 'Mascota no encontrada' })
  update(
    @CurrentUser() user: UserResponse,
    @Param('petId') petId: string,
    @Body() dto: UpdatePetDto,
  ): Promise<PetResponse> {
    return this.petsService.update(user.id, petId, dto);
  }

  @Delete(':petId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una mascota (desvincula collar si tenía)' })
  @ApiResponse({ status: 204, description: 'Mascota eliminada' })
  @ApiResponse({ status: 404, description: 'Mascota no encontrada' })
  remove(
    @CurrentUser() user: UserResponse,
    @Param('petId') petId: string,
  ): Promise<void> {
    return this.petsService.remove(user.id, petId);
  }
}
