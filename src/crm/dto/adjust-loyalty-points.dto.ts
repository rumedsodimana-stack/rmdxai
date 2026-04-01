import { IsString, IsNumber, IsOptional, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AdjustLoyaltyPointsDto {
  @ApiProperty({ description: 'Points to add (positive) or remove (negative)' })
  @IsNumber()
  @Type(() => Number)
  points: number;

  @ApiProperty({
    description: 'Transaction type',
    enum: ['earn', 'redeem', 'adjust', 'expire'],
  })
  @IsString()
  @IsIn(['earn', 'redeem', 'adjust', 'expire'])
  type: 'earn' | 'redeem' | 'adjust' | 'expire';

  @ApiProperty({ description: 'Human-readable description of the transaction' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: 'Type of entity this transaction references (e.g. reservation, purchase)' })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({ description: 'ID of the referenced entity' })
  @IsOptional()
  @IsString()
  referenceId?: string;
}
