import { ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProblemException } from '../../common/exceptions/problem.exception';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    _info: unknown,
    _context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      throw new ProblemException({
        status: HttpStatus.UNAUTHORIZED,
        code: 'UNAUTHORIZED',
        title: 'Unauthorized',
        detail: 'Token de acceso ausente, inválido o vencido.',
      });
    }
    return user;
  }
}
