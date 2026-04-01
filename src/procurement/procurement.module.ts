import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ProcurementController } from './procurement.controller';
import { ProcurementService } from './procurement.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'procurement' }),
  ],
  controllers: [ProcurementController],
  providers: [ProcurementService],
  exports: [ProcurementService],
})
export class ProcurementModule {}
