import { IsString, IsOptional, IsDateString, IsIn, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class KpiQueryDto {
  @ApiProperty({
    example: 'daily',
    description: 'Aggregation period: daily | weekly | monthly',
  })
  @IsIn(['daily', 'weekly', 'monthly'])
  @IsNotEmpty()
  period: string;

  @ApiPropertyOptional({ example: '2025-09-01', description: 'Start of range (inclusive)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2025-09-30', description: 'End of range (inclusive)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
