<<<<<<< HEAD
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
=======
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
>>>>>>> e1320ea31da6df2bf4fa7967b6c9490a272bd2a9
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePetDto {
  @ApiProperty({ example: 'Luna' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'dog',
    description: 'Valores sugeridos: dog, cat, other (acepta strings para interoperabilidad)',
  })
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

  @ApiPropertyOptional({ example: 'https://ejemplo.com/luna.jpg', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string | null;
}

<<<<<<< HEAD
export class UpdatePetDto extends PartialType(CreatePetDto) {}
=======
export class UpdatePetDto {
  @ApiPropertyOptional({ example: 'Luna' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'dog' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  species?: string;

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

  @ApiPropertyOptional({ example: 'https://ejemplo.com/luna.jpg', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string | null;
}
>>>>>>> e1320ea31da6df2bf4fa7967b6c9490a272bd2a9

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
