import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const method = req.method;

    // Only log state-changing operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (response) => {
        if (!user?.propertyId) return;
        try {
          await this.prisma.auditLog.create({
            data: {
              propertyId: user.propertyId,
              actorId: user.id,
              actorRole: user.role,
              action: `${method} ${req.path}`,
              entityType: req.path.split('/')[2] || 'unknown',
              entityId: response?.id || req.params?.id || 'unknown',
              newValues: response,
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
            },
          });
        } catch {
          // Audit failures should never break the request
        }
      }),
    );
  }
}
