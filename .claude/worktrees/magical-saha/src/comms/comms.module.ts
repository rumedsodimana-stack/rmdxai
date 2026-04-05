import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CommsController } from './comms.controller';
import { CommsService } from './comms.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'comms' }),
  ],
  controllers: [CommsController],
  providers: [CommsService],
  exports: [CommsService],
})
export class CommsModule {}
