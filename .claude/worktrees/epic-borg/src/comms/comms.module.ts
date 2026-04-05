import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CommsController } from './comms.controller';
import { CommsService } from './comms.service';
import { PrismaService } from '../../prisma.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'comms' }),
  ],
  controllers: [CommsController],
  providers: [CommsService, PrismaService],
  exports: [CommsService],
})
export class CommsModule {}
