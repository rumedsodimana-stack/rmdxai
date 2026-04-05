import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GuestFeedbackDto {
  @ApiProperty({ description: 'Overall rating (1–10)', minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  overallRating: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  cleanlinessRating?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  serviceRating?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  locationRating?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  valueRating?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  facilityRating?: number;

  @ApiPropertyOptional({ description: 'Free-text comments' })
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiPropertyOptional({ default: false, description: 'Allow public display of feedback' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean = false;

  @ApiPropertyOptional({ description: 'Associated reservation ID' })
  @IsOptional()
  @IsString()
  reservationId?: string;
}
