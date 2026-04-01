import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { GuestAppController } from './guest-app.controller';
import { GuestAppService } from './guest-app.service';
import { PrismaService } from '../../prisma.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'guest-app' }),
  ],
  controllers: [GuestAppController],
  providers: [GuestAppService, PrismaService],
  exports: [GuestAppService],
})
export class GuestAppModule {}
