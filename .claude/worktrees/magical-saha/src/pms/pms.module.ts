import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PmsController } from './pms.controller';
import { PmsService } from './pms.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'pms' }),
  ],
  controllers: [PmsController],
  providers: [PmsService],
  exports: [PmsService],
})
export class PmsModule {}
