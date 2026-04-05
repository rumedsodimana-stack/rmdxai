import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsDateString,
  IsBoolean,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SetupStyle } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateFunctionSheetDto {
  @ApiProperty({ description: 'Event booking ID this sheet belongs to' })
  @IsString()
  @IsNotEmpty()
  eventBookingId: string;

  @ApiProperty({ description: 'Venue / room name', example: 'Grand Ballroom' })
  @IsString()
  @IsNotEmpty()
  venueName: string;

  @ApiProperty({ enum: SetupStyle, description: 'Room setup configuration style' })
  @IsEnum(SetupStyle)
  setupStyle: SetupStyle;

  @ApiProperty({ description: 'Number of guests capacity used' })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  capacityUsed: number;

  @ApiProperty({ description: 'Session start time (ISO 8601)' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ description: 'Session end time (ISO 8601)' })
  @IsDateString()
  endTime: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  decorNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cateringNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  staffNotes?: string;

  @ApiPropertyOptional({ description: 'Room setup time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  setupTime?: string;

  @ApiPropertyOptional({ description: 'Room breakdown time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  breakdownTime?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isConfirmed?: boolean = false;
}
