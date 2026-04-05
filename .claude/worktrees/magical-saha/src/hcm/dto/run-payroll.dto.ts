import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RunPayrollDto {
  @ApiProperty({ example: '2025-09-01', description: 'Payroll period start date' })
  @IsDateString()
  periodStart: string;

  @ApiProperty({ example: '2025-09-30', description: 'Payroll period end date' })
  @IsDateString()
  periodEnd: string;

  @ApiPropertyOptional({ description: 'Only include staff from this department ID' })
  @IsOptional()
  @IsString()
  departmentId?: string;
}
