import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Ensures the authenticated user can only access resources from their own property.
 * Apply after JwtAuthGuard.
 */
@Injectable()
export class PropertyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) throw new ForbiddenException();

    // ADMIN role can access any property
    if (user.role === 'ADMIN') return true;

    const propertyIdFromParam = request.params?.propertyId;
    const propertyIdFromQuery = request.query?.propertyId;
    const propertyIdFromBody = request.body?.propertyId;

    const targetPropertyId = propertyIdFromParam || propertyIdFromQuery || propertyIdFromBody;

    if (targetPropertyId && targetPropertyId !== user.propertyId) {
      throw new ForbiddenException('Access restricted to your own property');
    }

    return true;
  }
}
