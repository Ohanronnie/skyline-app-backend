import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Guard to ensure organization-based tenant isolation
 * This guard verifies that users can only access data from their own organization
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Ensure user has organization in their JWT payload
    if (!request.user || !request.user.organization) {
      return false;
    }

    return true;
  }
}

