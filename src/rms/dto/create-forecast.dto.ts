import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateForecastDto {
  @ApiProperty({ example: '2025-09-15', description: 'Date this forecast applies to' })
  @IsDateString()
  @IsNotEmpty()
  forecastDate: string;

  @ApiPropertyOptional({ description: 'Scope forecast to a specific room type; omit for property-wide' })
  @IsOptional()
  @IsString()
  roomTypeId?: string;

  @ApiProperty({ example: 82.5, description: 'Predicted occupancy percentage (0–100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  predictedOccupancy: number;

  @ApiProperty({ example: 220.0, description: 'Predicted Average Daily Rate' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  predictedADR: number;

  @ApiProperty({ example: 181.5, description: 'Predicted Revenue Per Available Room' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  predictedRevPAR: number;

  @ApiProperty({ example: 230.0, description: 'Recommended rate for the forecasted date' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  recommendedRate: number;

  @ApiPropertyOptional({ example: 0.87, description: 'Model confidence score (0–1)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  confidenceScore?: number;

  @ApiPropertyOptional({ example: 'v2.1.0', description: 'Forecasting model version identifier' })
  @IsOptional()
  @IsString()
  modelVersion?: string;
}
