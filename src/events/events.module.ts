import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'events' }),
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
