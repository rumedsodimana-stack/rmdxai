import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { OsKernelController } from './os-kernel.controller';
import { OsKernelService } from './os-kernel.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'os-kernel' }),
  ],
  controllers: [OsKernelController],
  providers: [OsKernelService],
  exports: [OsKernelService],
})
export class OsKernelModule {}
