import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePairingCodeDto {
  @ApiPropertyOptional({ example: 'Collar de Luna' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}

export class LinkDeviceDto {
  @ApiProperty({ example: 'dev_01abc234' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  deviceId: string;
}

export class CreateEmbedTokenDto {
  @ApiPropertyOptional({
    type: [String],
    example: ['dev_01abc234'],
    description: 'Lista opcional de deviceIds del usuario (1 a 50)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  deviceIds?: string[];

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Opcional: emitir token solo para el dispositivo de esta mascota',
  })
  @IsOptional()
  @IsString()
  petId?: string;

  @ApiPropertyOptional({
    example: 900,
    minimum: 1,
    maximum: 3600,
    description: 'Duración del token en segundos (1..3600)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3600)
  ttlS?: number;
}

export interface PairingCodeResponse {
  code: string;
  expiresAt: string;
}

export interface DeviceResponse {
  deviceId: string;
  name: string;
  productId: string;
  online: boolean;
  lastSeenAt: string | null;
  petId: string | null;
}

export interface EmbedTokenResponse {
  token: string;
  expiresAt: string;
}
