import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimString } from '../../common/dto/transformers';

export class CreatePairingCodeDto {
  @ApiPropertyOptional({ example: 'Collar de Luna' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}

export class LinkDeviceDto {
  @ApiProperty({ example: 'dev_01abc234' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  deviceId: string;
}

export class CreateEmbedTokenDto {
  @ApiPropertyOptional({
    type: [String],
    description:
      'Lista opcional de deviceIds del usuario (1 a 50). Si se omite, incluye todos los collares vinculados del usuario.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  deviceIds?: string[];

  @ApiPropertyOptional({
    description:
      'Opcional: emitir token solo para el dispositivo vinculado a esta mascota',
  })
  @IsOptional()
  @IsString()
  petId?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 3600,
    description: 'Duración del token en segundos (1..3600)',
  })
  @IsOptional()
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
