import { Module } from '@nestjs/common';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { TransformInterceptor } from './interceptors/transform.interceptor';

@Module({
  providers: [AuditInterceptor, TransformInterceptor],
  exports: [AuditInterceptor, TransformInterceptor],
})
export class CommonModule {}
