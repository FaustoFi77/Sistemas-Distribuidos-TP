import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
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
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AlertStatus, AlertType } from '../entities/alert.entity';

export class CreateZoneDto {
  @ApiProperty({ example: 'Casa' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: -34.603722, minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  centerLat: number;

  @ApiProperty({ example: -58.381592, minimum: -180, maximum: 180 })
  @Type(() => Number)
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
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  @Max(50000)
  radiusMeters: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateZoneDto {
  @ApiPropertyOptional({ example: 'Plaza del barrio' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: -34.603722, minimum: -90, maximum: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  centerLat?: number;

  @ApiPropertyOptional({ example: -58.381592, minimum: -180, maximum: 180 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  centerLon?: number;

  @ApiPropertyOptional({ example: 150, minimum: 10, maximum: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  @Max(50000)
  radiusMeters?: number;

  @ApiPropertyOptional({ example: true })
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

export interface ZoneEvaluationItem {
  zoneId: string;
  name: string;
  centerLat: number;
  centerLon: number;
  radiusMeters: number;
  distanceMeters: number | null;
  inside: boolean | null;
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
