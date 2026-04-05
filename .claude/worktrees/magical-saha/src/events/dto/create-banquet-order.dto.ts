import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateBanquetOrderDto {
  @ApiProperty({ description: 'Event booking ID this order belongs to' })
  @IsString()
  @IsNotEmpty()
  eventBookingId: string;

  @ApiPropertyOptional({ description: 'Menu package name', example: 'Silver Package' })
  @IsOptional()
  @IsString()
  menuPackage?: string;

  @ApiProperty({ description: 'Per-person food cost' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  perPersonCost: number;

  @ApiProperty({ description: 'Total number of guests for this order' })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  totalGuests: number;

  @ApiPropertyOptional({ description: 'Dietary restrictions / notes' })
  @IsOptional()
  @IsString()
  dietaryNotes?: string;

  @ApiPropertyOptional({ description: 'Beverage package', example: 'Open Bar' })
  @IsOptional()
  @IsString()
  beveragePackage?: string;

  @ApiPropertyOptional({ description: 'Number of banquet staff required', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  staffRequired?: number = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
