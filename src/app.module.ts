import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

// Core
import { PrismaModule } from './prisma.module';
import { CommonModule } from './common/common.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

// Feature modules
import { AuthModule } from './auth/auth.module';
import { PmsModule } from './pms/pms.module';
import { PosModule } from './pos/pos.module';
import { ChannelModule } from './channel/channel.module';
import { RmsModule } from './rms/rms.module';
import { CrmModule } from './crm/crm.module';
import { FinanceModule } from './finance/finance.module';
import { HcmModule } from './hcm/hcm.module';
import { ProcurementModule } from './procurement/procurement.module';
import { BmsModule } from './bms/bms.module';
import { SecurityModule } from './security/security.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { GuestAppModule } from './guest-app/guest-app.module';
import { CommsModule } from './comms/comms.module';
import { OsKernelModule } from './os-kernel/os-kernel.module';
import { MultiPropertyModule } from './multi-property/multi-property.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    // Config (global)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('THROTTLE_TTL', 60),
          limit: config.get<number>('THROTTLE_LIMIT', 100),
        },
      ],
    }),

    // BullMQ / Redis
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD') || undefined,
        },
      }),
    }),

    // Core infrastructure
    PrismaModule,
    CommonModule,

    // Feature modules
    AuthModule,
    PmsModule,
    PosModule,
    ChannelModule,
    RmsModule,
    CrmModule,
    FinanceModule,
    HcmModule,
    ProcurementModule,
    BmsModule,
    SecurityModule,
    AnalyticsModule,
    GuestAppModule,
    CommsModule,
    OsKernelModule,
    MultiPropertyModule,
    EventsModule,
  ],
  providers: [
    // Global rate-limit guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global response envelope
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
