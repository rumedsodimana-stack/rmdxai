import { Module } from '@nestjs/common';
import { MultiPropertyController } from './multi-property.controller';
import { MultiPropertyService } from './multi-property.service';
import { PrismaService } from '../../prisma.service';

@Module({
  controllers: [MultiPropertyController],
  providers: [MultiPropertyService, PrismaService],
  exports: [MultiPropertyService],
})
export class MultiPropertyModule {}
