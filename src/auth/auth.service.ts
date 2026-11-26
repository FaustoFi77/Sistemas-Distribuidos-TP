import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { isUniqueConstraintError } from '../common/exceptions/db-error.utils';
import { ProblemException } from '../common/exceptions/problem.exception';
import { parseFiniteEnvNumber } from '../config/env.validation';
import {
  AuthTokenResponse,
  LoginDto,
  RegisterDto,
  UserResponse,
} from './dto/auth.dto';
import { User } from './entities/user.entity';

const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  private readonly expiresInSeconds: number;

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.expiresInSeconds = parseFiniteEnvNumber(
      this.config.get<string>('JWT_EXPIRES_IN_SECONDS', '86400'),
      86400,
      { min: 1 },
    );
  }

  async register(dto: RegisterDto): Promise<AuthTokenResponse> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const existing = await this.usersRepo.findOne({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ProblemException({
        status: HttpStatus.CONFLICT,
        code: 'EMAIL_ALREADY_EXISTS',
        title: 'Conflict',
        detail: 'Ya existe una cuenta registrada con ese correo electrónico.',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = this.usersRepo.create({
      email: normalizedEmail,
      passwordHash,
      name: dto.name.trim(),
      phone: dto.phone?.trim() || null,
    });
    let saved: User;
    try {
      saved = await this.usersRepo.save(user);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ProblemException({
          status: HttpStatus.CONFLICT,
          code: 'EMAIL_ALREADY_EXISTS',
          title: 'Conflict',
          detail: 'Ya existe una cuenta registrada con ese correo electrónico.',
        });
      }
      throw err;
    }

    return this.buildAuthToken(saved);
  }

  async login(dto: LoginDto): Promise<AuthTokenResponse> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.usersRepo.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new ProblemException({
        status: HttpStatus.UNAUTHORIZED,
        code: 'INVALID_CREDENTIALS',
        title: 'Unauthorized',
        detail: 'Email o contraseña incorrectos.',
      });
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new ProblemException({
        status: HttpStatus.UNAUTHORIZED,
        code: 'INVALID_CREDENTIALS',
        title: 'Unauthorized',
        detail: 'Email o contraseña incorrectos.',
      });
    }

    return this.buildAuthToken(user);
  }

  toUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone ?? null,
    };
  }

  private buildAuthToken(user: User): AuthTokenResponse {
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.expiresInSeconds,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.expiresInSeconds,
      user: this.toUserResponse(user),
    };
  }
}
