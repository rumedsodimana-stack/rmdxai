import { IsString, IsOptional, IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RateRecommendationQueryDto {
  @ApiProperty({ example: '2025-09-15', description: 'Start of date range for recommendations' })
  @IsDateString()
  @IsNotEmpty()
  fromDate: string;

  @ApiProperty({ example: '2025-09-22', description: 'End of date range for recommendations' })
  @IsDateString()
  @IsNotEmpty()
  toDate: string;

  @ApiPropertyOptional({ description: 'Scope to a specific room type; omit for all types' })
  @IsOptional()
  @IsString()
  roomTypeId?: string;
}
