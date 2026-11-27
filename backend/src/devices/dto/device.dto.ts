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
import {
  PaginatedResponse,
  PaginationMetaDto,
} from '../../common/dto/pagination.dto';
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

export class PairingCodeResponseDto implements PairingCodeResponse {
  @ApiProperty({ example: 'A1B2C3' })
  code: string;

  @ApiProperty({ example: '2026-06-01T12:10:00.000Z' })
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

export class DeviceResponseDto implements DeviceResponse {
  @ApiProperty({ example: 'dev_01abc234' })
  deviceId: string;

  @ApiProperty({ example: 'Collar de Luna' })
  name: string;

  @ApiProperty({ example: 'ob.lora.unit' })
  productId: string;

  @ApiProperty({ example: true })
  online: boolean;

  @ApiProperty({
    type: String,
    example: '2026-06-01T12:00:00.000Z',
    nullable: true,
  })
  lastSeenAt: string | null;

  @ApiProperty({
    type: String,
    example: '550e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  petId: string | null;
}

export class PaginatedDeviceResponseDto implements PaginatedResponse<DeviceResponseDto> {
  @ApiProperty({ type: () => [DeviceResponseDto] })
  data: DeviceResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}

export interface EmbedTokenResponse {
  token: string;
  expiresAt: string;
}

export class EmbedTokenResponseDto implements EmbedTokenResponse {
  @ApiProperty({ example: 'ob_emb_eyJhbGciOi...' })
  token: string;

  @ApiProperty({ example: '2026-06-01T12:15:00.000Z' })
  expiresAt: string;
}
