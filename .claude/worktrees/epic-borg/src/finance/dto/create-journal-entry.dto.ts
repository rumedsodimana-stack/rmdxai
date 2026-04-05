import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsArray,
  ValidateNested,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { JournalEntryType } from '@prisma/client';

export class JournalLineDto {
  @ApiProperty({ description: 'Chart of account ID' })
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({ enum: JournalEntryType, description: 'DEBIT or CREDIT' })
  @IsEnum(JournalEntryType)
  type: JournalEntryType;

  @ApiProperty({ example: 1500.00 })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({ example: 'Room revenue accrual' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateJournalEntryDto {
  @ApiProperty({ example: 'Room revenue for September 2025' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 'folio', description: 'Source entity type' })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({ example: 'abc-123', description: 'Source entity ID' })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiProperty({ example: '2025-09-30', description: 'Accounting date for this entry' })
  @IsDateString()
  entryDate: string;

  @ApiProperty({ type: [JournalLineDto], description: 'Debit and credit lines (must balance)' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines: JournalLineDto[];
}
