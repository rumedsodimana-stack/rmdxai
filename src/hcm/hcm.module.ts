import { Module } from '@nestjs/common';
import { HcmController } from './hcm.controller';
import { HcmService } from './hcm.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [HcmController],
  providers: [HcmService, PrismaService],
  exports: [HcmService],
})
export class HcmModule {}
