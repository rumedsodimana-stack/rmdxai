import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BmsController } from './bms.controller';
import { BmsService } from './bms.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'bms' }),
  ],
  controllers: [BmsController],
  providers: [BmsService],
  exports: [BmsService],
})
export class BmsModule {}
