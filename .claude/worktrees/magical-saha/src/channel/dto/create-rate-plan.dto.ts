import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDateString,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateRatePlanDto {
  @ApiProperty({ description: 'ID of the room type this rate plan applies to' })
  @IsString()
  @IsNotEmpty()
  roomTypeId: string;

  @ApiProperty({ description: 'Short unique code for the rate plan (e.g. BAR, PKG_BB)' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Display name of the rate plan' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Description of the rate plan' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Base nightly rate in property currency' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  baseRate: number;

  @ApiProperty({ description: 'Meal plan code: room_only, bb, hb, fb, ai' })
  @IsString()
  @IsNotEmpty()
  mealPlan: string;

  @ApiPropertyOptional({ description: 'Minimum length of stay in nights', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  minLOS?: number = 1;

  @ApiPropertyOptional({ description: 'Maximum length of stay in nights' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  maxLOS?: number;

  @ApiPropertyOptional({ description: 'Minimum advance booking days required' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  advanceBooking?: number;

  @ApiPropertyOptional({ description: 'Cancellation policy description' })
  @IsOptional()
  @IsString()
  cancellationPolicy?: string;

  @ApiPropertyOptional({ description: 'Date from which this rate plan is valid (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  validFrom?: Date;

  @ApiPropertyOptional({ description: 'Date until which this rate plan is valid (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  validUntil?: Date;
}
