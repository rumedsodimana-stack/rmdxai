import { IsString, IsOptional, IsDateString, IsIn, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReportQueryDto {
  @ApiProperty({
    example: 'occupancy',
    description: 'Report type: occupancy | revenue | hcm | procurement | pos | combined',
  })
  @IsIn(['occupancy', 'revenue', 'hcm', 'procurement', 'pos', 'combined'])
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: '2025-09-01', description: 'Start of report range (inclusive)' })
  @IsDateString()
  @IsNotEmpty()
  fromDate: string;

  @ApiProperty({ example: '2025-09-30', description: 'End of report range (inclusive)' })
  @IsDateString()
  @IsNotEmpty()
  toDate: string;

  @ApiPropertyOptional({
    example: 'monthly',
    description: 'Bucket size for time-series data: daily | weekly | monthly',
  })
  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'])
  period?: string;
}
