import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { ProblemException } from '../../common/exceptions/problem.exception';
import { UserResponse } from '../dto/auth.dto';
import { User } from '../entities/user.entity';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-secret-change-me'),
    });
  }

  async validate(payload: JwtPayload): Promise<UserResponse> {
    const user = await this.usersRepo.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw new ProblemException({
        status: HttpStatus.UNAUTHORIZED,
        code: 'UNAUTHORIZED',
        title: 'Unauthorized',
        detail: 'El usuario asociado al token ya no existe.',
      });
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone ?? null,
    };
  }
}
