import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString } from '../../common/dto/transformers';

export class RegisterDto {
  @ApiProperty({ example: 'juan@ejemplo.com' })
  @Transform(trimString)
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Secreto123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/\S/, {
    message: 'password no puede contener solo espacios en blanco',
  })
  password: string;

  @ApiProperty({ example: 'Juan Pérez' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: '+54 9 11 5555-1234', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;
}

export class LoginDto {
  @ApiProperty({ example: 'juan@ejemplo.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Secreto123!' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  phone: string | null;
}

export interface AuthTokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: UserResponse;
}
