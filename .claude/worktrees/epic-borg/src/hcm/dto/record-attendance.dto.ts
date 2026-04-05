import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AttendanceStatus } from '@prisma/client';

export class RecordAttendanceDto {
  @ApiProperty({ description: 'Staff member ID' })
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @ApiPropertyOptional({ description: 'Shift ID (optional — may not always be linked to a shift)' })
  @IsOptional()
  @IsString()
  shiftId?: string;

  @ApiProperty({ example: '2025-09-01', description: 'Attendance date (ISO 8601 date)' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ example: '2025-09-01T07:05:00Z', description: 'Clock-in datetime' })
  @IsOptional()
  @IsDateString()
  clockIn?: string;

  @ApiPropertyOptional({ example: '2025-09-01T15:10:00Z', description: 'Clock-out datetime' })
  @IsOptional()
  @IsDateString()
  clockOut?: string;

  @ApiProperty({ enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @ApiPropertyOptional({ example: 8.0, description: 'Hours worked (auto-calculated if clockIn/clockOut provided)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  hoursWorked?: number;

  @ApiPropertyOptional({ example: 0.5, description: 'Overtime hours' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  overtime?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
