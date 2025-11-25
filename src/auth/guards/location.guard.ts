import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../user/users.schema';

@Injectable()
export class LocationGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();

    // Admin has access to everything
    if (user?.role === UserRole.ADMIN) return true;

    // Location staff must have warehouseId assigned
    if (!user?.warehouseId) {
      throw new ForbiddenException('No warehouse assigned to user');
    }

    return true;
  }
}
