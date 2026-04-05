import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsArray,
  IsEnum,
  IsIn,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PricingRuleType } from '@prisma/client';

export class CreatePricingRuleDto {
  @ApiProperty({ example: 'Weekend Premium', description: 'Human-readable rule name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: PricingRuleType, example: PricingRuleType.PERCENTAGE })
  @IsEnum(PricingRuleType)
  type: PricingRuleType;

  @ApiPropertyOptional({ description: 'Restrict rule to a specific room type ID' })
  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @ApiPropertyOptional({
    example: 'occupancy_pct',
    description: 'Metric that triggers this rule: occupancy_pct | days_to_arrival | competitor_rate',
  })
  @IsOptional()
  @IsString()
  triggerMetric?: string;

  @ApiPropertyOptional({ example: 75, description: 'Threshold value for the trigger metric' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  triggerValue?: number;

  @ApiProperty({
    example: 'percentage',
    description: 'How the adjustment is applied: percentage or fixed',
  })
  @IsIn(['percentage', 'fixed'])
  adjustmentType: string;

  @ApiProperty({ example: 15, description: 'Adjustment amount (% or fixed currency amount)' })
  @IsNumber()
  @Type(() => Number)
  adjustmentValue: number;

  @ApiPropertyOptional({ example: 80, description: 'Floor rate — resulting rate will never go below this' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minRate?: number;

  @ApiPropertyOptional({ example: 500, description: 'Ceiling rate — resulting rate will never exceed this' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxRate?: number;

  @ApiPropertyOptional({ example: 10, description: 'Evaluation priority — lower number = higher priority' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  priority?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '2025-01-01', description: 'Start date for this rule (inclusive)' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({ example: '2025-12-31', description: 'End date for this rule (inclusive)' })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({
    type: [Number],
    example: [5, 6],
    description: 'Days of week this rule applies (0=Sun … 6=Sat). Empty = all days.',
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @Type(() => Number)
  daysOfWeek?: number[];
}
