import { IsString, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateForecastDto {
  @ApiProperty({
    description: 'Start date for forecast range (YYYY-MM-DD)',
    example: '2025-12-01',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fromDate must be in YYYY-MM-DD format' })
  fromDate: string;

  @ApiProperty({
    description: 'End date for forecast range (YYYY-MM-DD)',
    example: '2025-12-31',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'toDate must be in YYYY-MM-DD format' })
  toDate: string;

  @ApiPropertyOptional({ description: 'Restrict forecast to a specific room type ID' })
  @IsOptional()
  @IsString()
  roomTypeId?: string;
}
