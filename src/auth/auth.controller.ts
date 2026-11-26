import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import {
  AuthTokenResponse,
  AuthTokenResponseDto,
  LoginDto,
  RegisterDto,
  UserResponse,
  UserResponseDto,
} from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Registrar un nuevo usuario' })
  @ApiResponse({
    status: 201,
    description: 'Usuario creado y token emitido',
    type: AuthTokenResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos (RFC 9457)' })
  @ApiResponse({ status: 409, description: 'Email ya registrado' })
  @ApiResponse({ status: 429, description: 'Demasiados intentos' })
  register(@Body() dto: RegisterDto): Promise<AuthTokenResponse> {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión con email y contraseña' })
  @ApiResponse({
    status: 200,
    description: 'Token de acceso emitido',
    type: AuthTokenResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  @ApiResponse({ status: 429, description: 'Demasiados intentos' })
  login(@Body() dto: LoginDto): Promise<AuthTokenResponse> {
    return this.authService.login(dto);
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiResponse({
    status: 200,
    description: 'Perfil del usuario actual',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  me(@CurrentUser() user: UserResponse): UserResponse {
    return user;
  }
}
