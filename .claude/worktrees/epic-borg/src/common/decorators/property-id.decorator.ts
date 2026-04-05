import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Extracts the authenticated user's propertyId from the JWT. */
export const PropertyId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.propertyId;
  },
);
