import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PmsController } from './pms.controller';
import { PmsService } from './pms.service';
import { PrismaService } from '../../prisma.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'pms' }),
  ],
  controllers: [PmsController],
  providers: [PmsService, PrismaService],
  exports: [PmsService],
})
export class PmsModule {}
