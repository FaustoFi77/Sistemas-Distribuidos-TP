import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PaginatedResponse,
  PaginationMetaDto,
  PaginationQueryDto,
} from '../../common/dto/pagination.dto';
import { trimString } from '../../common/dto/transformers';
import { AlertStatus, AlertType } from '../entities/alert.entity';

export class CreateZoneDto {
  @ApiProperty({ example: 'Casa' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: -34.603722, minimum: -90, maximum: 90 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  centerLat: number;

  @ApiProperty({ example: -58.381592, minimum: -180, maximum: 180 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  centerLon: number;

  @ApiProperty({
    example: 100,
    minimum: 10,
    maximum: 50000,
    description: 'Radio de la zona circular en metros',
  })
  @IsNumber()
  @Min(10)
  @Max(50000)
  radiusMeters: number;

  @ApiPropertyOptional({
    default: true,
    description: 'Indica si la zona está activa al crearse (por defecto true)',
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateZoneDto extends PartialType(CreateZoneDto) {
  @ApiPropertyOptional({
    example: true,
    description: 'Omitir para mantener el estado actual sin cambios',
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class ZoneQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar zonas por petId' })
  @IsOptional()
  @IsString()
  petId?: string;
}

export class AlertQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['active', 'resolved'] })
  @IsOptional()
  @IsIn(['active', 'resolved'])
  status?: AlertStatus;

  @ApiPropertyOptional({ enum: ['ZONE_EXIT', 'LINK_LOSS'] })
  @IsOptional()
  @IsIn(['ZONE_EXIT', 'LINK_LOSS'])
  type?: AlertType;

  @ApiPropertyOptional({ description: 'Filtrar alertas por petId' })
  @IsOptional()
  @IsString()
  petId?: string;
}

export interface SafeZoneResponse {
  id: string;
  petId: string;
  name: string;
  shape: 'circle';
  centerLat: number;
  centerLon: number;
  radiusMeters: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export class SafeZoneResponseDto implements SafeZoneResponse {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '660e8400-e29b-41d4-a716-446655440000' })
  petId: string;

  @ApiProperty({ example: 'Casa' })
  name: string;

  @ApiProperty({ enum: ['circle'], example: 'circle' })
  shape: 'circle';

  @ApiProperty({ example: -34.603722 })
  centerLat: number;

  @ApiProperty({ example: -58.381592 })
  centerLon: number;

  @ApiProperty({ example: 100 })
  radiusMeters: number;

  @ApiProperty({ example: true })
  active: boolean;

  @ApiProperty({ example: '2026-06-01T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-06-01T12:00:00.000Z' })
  updatedAt: string;
}

export class PaginatedSafeZoneResponseDto implements PaginatedResponse<SafeZoneResponseDto> {
  @ApiProperty({ type: () => [SafeZoneResponseDto] })
  data: SafeZoneResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}

export interface AlertResponse {
  id: string;
  petId: string;
  deviceId: string;
  zoneId: string | null;
  type: AlertType;
  status: AlertStatus;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  message: string;
  details: Record<string, unknown> | null;
  triggeredAt: string;
  resolvedAt: string | null;
}

export class AlertResponseDto implements AlertResponse {
  @ApiProperty({ example: '770e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: '660e8400-e29b-41d4-a716-446655440000' })
  petId: string;

  @ApiProperty({ example: 'dev_01abc234' })
  deviceId: string;

  @ApiProperty({
    type: String,
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  zoneId: string | null;

  @ApiProperty({ enum: ['ZONE_EXIT', 'LINK_LOSS'], example: 'ZONE_EXIT' })
  type: AlertType;

  @ApiProperty({ enum: ['active', 'resolved'], example: 'active' })
  status: AlertStatus;

  @ApiProperty({ example: false })
  acknowledged: boolean;

  @ApiProperty({ type: String, example: null, nullable: true })
  acknowledgedAt: string | null;

  @ApiProperty({ example: 'Luna salió de sus zonas seguras.' })
  message: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  details: Record<string, unknown> | null;

  @ApiProperty({ example: '2026-06-01T12:00:00.000Z' })
  triggeredAt: string;

  @ApiProperty({ type: String, example: null, nullable: true })
  resolvedAt: string | null;
}

export class PaginatedAlertResponseDto implements PaginatedResponse<AlertResponseDto> {
  @ApiProperty({ type: () => [AlertResponseDto] })
  data: AlertResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}

export interface ZoneEvaluationItem {
  zoneId: string;
  name: string;
  centerLat: number;
  centerLon: number;
  radiusMeters: number;
  distanceMeters: number | null;
  inside: boolean | null;
}

export class ZoneEvaluationItemDto implements ZoneEvaluationItem {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  zoneId: string;

  @ApiProperty({ example: 'Casa' })
  name: string;

  @ApiProperty({ example: -34.603722 })
  centerLat: number;

  @ApiProperty({ example: -58.381592 })
  centerLon: number;

  @ApiProperty({ example: 100 })
  radiusMeters: number;

  @ApiProperty({ type: Number, example: 42.5, nullable: true })
  distanceMeters: number | null;

  @ApiProperty({ type: Boolean, example: true, nullable: true })
  inside: boolean | null;
}

export class LastLocationDto {
  @ApiProperty({ example: -34.603722 })
  lat: number;

  @ApiProperty({ example: -58.381592 })
  lon: number;

  @ApiPropertyOptional({ example: 1.2 })
  hdop?: number;

  @ApiPropertyOptional({ example: '3d' })
  fix?: string;

  @ApiProperty({ example: '2026-06-01T12:00:00.000Z' })
  ts: string;
}

export interface PetMonitoringResponse {
  petId: string;
  deviceId: string | null;
  linkStatus: 'online' | 'offline' | 'unknown';
  collarOnline: boolean | null;
  bridgeOnline: boolean | null;
  lastSeenAt: string | null;
  lastLocation: {
    lat: number;
    lon: number;
    hdop?: number;
    fix?: string;
    ts: string;
  } | null;
  insideSafeArea: boolean | null;
  zones: ZoneEvaluationItem[];
  activeAlerts: AlertResponse[];
}

export class PetMonitoringResponseDto implements PetMonitoringResponse {
  @ApiProperty({ example: '660e8400-e29b-41d4-a716-446655440000' })
  petId: string;

  @ApiProperty({ type: String, example: 'dev_01abc234', nullable: true })
  deviceId: string | null;

  @ApiProperty({ enum: ['online', 'offline', 'unknown'], example: 'online' })
  linkStatus: 'online' | 'offline' | 'unknown';

  @ApiProperty({ type: Boolean, example: true, nullable: true })
  collarOnline: boolean | null;

  @ApiProperty({ type: Boolean, example: true, nullable: true })
  bridgeOnline: boolean | null;

  @ApiProperty({
    type: String,
    example: '2026-06-01T12:00:00.000Z',
    nullable: true,
  })
  lastSeenAt: string | null;

  @ApiProperty({ type: () => LastLocationDto, nullable: true })
  lastLocation: LastLocationDto | null;

  @ApiProperty({ type: Boolean, example: true, nullable: true })
  insideSafeArea: boolean | null;

  @ApiProperty({ type: () => [ZoneEvaluationItemDto] })
  zones: ZoneEvaluationItemDto[];

  @ApiProperty({ type: () => [AlertResponseDto] })
  activeAlerts: AlertResponseDto[];
}
