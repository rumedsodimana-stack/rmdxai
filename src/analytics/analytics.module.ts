import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../../prisma.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'analytics' }),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, PrismaService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
