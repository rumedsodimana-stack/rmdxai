import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ShiftType } from '@prisma/client';

export class CreateShiftDto {
  @ApiProperty({ description: 'Staff member ID' })
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @ApiProperty({ enum: ShiftType })
  @IsEnum(ShiftType)
  type: ShiftType;

  @ApiProperty({ example: '2025-09-01T07:00:00Z', description: 'Shift start datetime (ISO 8601)' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ example: '2025-09-01T15:00:00Z', description: 'Shift end datetime (ISO 8601)' })
  @IsDateString()
  endTime: string;

  @ApiPropertyOptional({ example: 30, description: 'Break duration in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  breakMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isConfirmed?: boolean;
}
