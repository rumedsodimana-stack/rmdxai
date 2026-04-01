import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { PrismaService } from '../../prisma.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'security' }),
  ],
  controllers: [SecurityController],
  providers: [SecurityService, PrismaService],
  exports: [SecurityService],
})
export class SecurityModule {}
