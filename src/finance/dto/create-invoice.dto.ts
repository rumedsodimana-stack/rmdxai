import {
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsNotEmpty,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateInvoiceDto {
  @ApiPropertyOptional({ description: 'Guest profile ID to associate with this invoice' })
  @IsOptional()
  @IsString()
  guestProfileId?: string;

  @ApiPropertyOptional({ description: 'Company name for corporate invoices' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty({ description: 'Invoice due date (ISO 8601)' })
  @IsDateString()
  dueDate: Date;

  @ApiProperty({ description: 'Subtotal before tax' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  subtotal: number;

  @ApiProperty({ description: 'Tax amount' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  taxAmount: number;

  @ApiProperty({ description: 'Total (subtotal + taxAmount)' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  total: number;

  @ApiPropertyOptional({ description: 'Additional notes for the invoice' })
  @IsOptional()
  @IsString()
  notes?: string;
}
