import { Module } from '@nestjs/common';
import { MultiPropertyController } from './multi-property.controller';
import { MultiPropertyService } from './multi-property.service';

@Module({
  controllers: [MultiPropertyController],
  providers: [MultiPropertyService],
  exports: [MultiPropertyService],
})
export class MultiPropertyModule {}
