import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import {
  PaginatedResponse,
  PaginationMetaDto,
} from '../../common/dto/pagination.dto';
import { trimString } from '../../common/dto/transformers';

export class CreatePetDto {
  @ApiProperty({ example: 'Luna' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'dog',
    description:
      'Valores sugeridos: dog, cat, other (acepta strings para interoperabilidad)',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  species: string;

  @ApiPropertyOptional({ example: 'Golden Retriever', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  breed?: string | null;

  @ApiPropertyOptional({ example: '2022-05-14', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  birthDate?: string | null;

  @ApiPropertyOptional({
    example: 'https://ejemplo.com/luna.jpg',
    nullable: true,
  })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_tld: false,
    },
    {
      message:
        'photoUrl debe ser una URL válida con esquema http:// o https://',
    },
  )
  photoUrl?: string | null;
}

export class UpdatePetDto extends PartialType(CreatePetDto) {}

export interface PetResponse {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  birthDate: string | null;
  photoUrl: string | null;
  deviceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export class PetResponseDto implements PetResponse {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Luna' })
  name: string;

  @ApiProperty({ example: 'dog' })
  species: string;

  @ApiProperty({ type: String, example: 'Golden Retriever', nullable: true })
  breed: string | null;

  @ApiProperty({ type: String, example: '2022-05-14', nullable: true })
  birthDate: string | null;

  @ApiProperty({
    type: String,
    example: 'https://ejemplo.com/luna.jpg',
    nullable: true,
  })
  photoUrl: string | null;

  @ApiProperty({ type: String, example: 'dev_01abc234', nullable: true })
  deviceId: string | null;

  @ApiProperty({ example: '2026-06-01T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-06-01T12:00:00.000Z' })
  updatedAt: string;
}

export class PaginatedPetResponseDto implements PaginatedResponse<PetResponseDto> {
  @ApiProperty({ type: () => [PetResponseDto] })
  data: PetResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}
