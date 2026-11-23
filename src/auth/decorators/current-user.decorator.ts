import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserResponse } from '../dto/auth.dto';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserResponse => {
    const request = ctx.switchToHttp().getRequest<{ user: UserResponse }>();
    return request.user;
  },
);
