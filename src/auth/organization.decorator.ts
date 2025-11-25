import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Organization } from '../user/users.schema';

export const CurrentOrganization = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): Organization => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.organization;
  },
);

