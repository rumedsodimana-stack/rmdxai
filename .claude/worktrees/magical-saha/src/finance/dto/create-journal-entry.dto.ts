import {
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNumber,
  IsEnum,
  IsNotEmpty,
  ArrayMinSize,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { JournalEntryType } from '@prisma/client';

export class JournalLineDto {
  @ApiProperty({ description: 'Account ID to post this line to' })
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({ enum: JournalEntryType, description: 'Debit or Credit' })
  @IsEnum(JournalEntryType)
  type: JournalEntryType;

  @ApiProperty({ description: 'Amount (must be positive)' })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({ description: 'Line-level description' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateJournalEntryDto {
  @ApiProperty({ description: 'Entry description' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: 'Entity type this entry relates to (e.g. folio, invoice, payroll)' })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({ description: 'ID of the referenced entity' })
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiProperty({ description: 'Accounting date of the entry (ISO 8601)' })
  @IsDateString()
  entryDate: Date;

  @ApiProperty({
    type: [JournalLineDto],
    description:
      'Journal lines — total debits must equal total credits (double-entry accounting)',
  })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines: JournalLineDto[];
}
