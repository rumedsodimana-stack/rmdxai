import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { RmsController } from './rms.controller';
import { RmsService } from './rms.service';
import { PrismaService } from '../../prisma.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'rms' }),
  ],
  controllers: [RmsController],
  providers: [RmsService, PrismaService],
  exports: [RmsService],
})
export class RmsModule {}
