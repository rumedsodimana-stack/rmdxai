import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'security' }),
  ],
  controllers: [SecurityController],
  providers: [SecurityService],
  exports: [SecurityService],
})
export class SecurityModule {}
