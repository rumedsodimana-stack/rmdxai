import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsInt,
  IsDateString,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AutomationLevel } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateAutomationTaskDto {
  @ApiProperty({ description: 'Human-readable task name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Event type that triggers this task', example: 'reservation.checkin' })
  @IsString()
  @IsNotEmpty()
  triggerEvent: string;

  @ApiProperty({ enum: AutomationLevel, description: 'L0=fully_manual … L4=fully_autonomous' })
  @IsEnum(AutomationLevel)
  automationLevel: AutomationLevel;

  @ApiProperty({ description: 'Task payload (parameters for the handler)' })
  @IsObject()
  payload: Record<string, any>;

  @ApiPropertyOptional({ description: 'Maximum retry attempts', default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  maxAttempts?: number = 3;

  @ApiPropertyOptional({ description: 'Schedule execution time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
