import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BmsController } from './bms.controller';
import { BmsService } from './bms.service';
import { PrismaService } from '../../prisma.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'bms' }),
  ],
  controllers: [BmsController],
  providers: [BmsService, PrismaService],
  exports: [BmsService],
})
export class BmsModule {}
