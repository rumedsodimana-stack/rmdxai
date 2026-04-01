import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateInvoiceDto {
  @ApiPropertyOptional({ description: 'Guest profile ID (individual billing)' })
  @IsOptional()
  @IsString()
  guestProfileId?: string;

  @ApiPropertyOptional({ description: 'Company name (corporate billing)' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty({ example: '2025-10-15', description: 'Invoice due date' })
  @IsDateString()
  dueDate: string;

  @ApiProperty({ example: 1200.00, description: 'Subtotal before tax' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  subtotal: number;

  @ApiProperty({ example: 144.00, description: 'Tax amount' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  taxAmount: number;

  @ApiPropertyOptional({ example: 'Corporate stay — ACME Corp, September 2025' })
  @IsOptional()
  @IsString()
  notes?: string;
}
