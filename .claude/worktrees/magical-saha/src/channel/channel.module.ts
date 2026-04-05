import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ChannelController } from './channel.controller';
import { ChannelService } from './channel.service';
import { ChannelSyncProcessor } from './channel-sync.processor';

@Module({
  imports: [BullModule.registerQueue({ name: 'channel-sync' })],
  controllers: [ChannelController],
  providers: [ChannelService, ChannelSyncProcessor],
  exports: [ChannelService],
})
export class ChannelModule {}
