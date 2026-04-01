import { IsEnum, IsOptional, IsObject, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class SettleBillDto {
  @ApiProperty({ enum: PaymentMethod, description: 'Payment method used to settle the bill' })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({
    example: { split1: 60, split2: 40 },
    description: 'Split payment details (amounts per payer/card/etc.)',
  })
  @IsOptional()
  @IsObject()
  splitDetails?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Folio ID to charge when paymentMethod is ROOM_CHARGE',
  })
  @IsOptional()
  @IsString()
  folioChargeId?: string;
}
