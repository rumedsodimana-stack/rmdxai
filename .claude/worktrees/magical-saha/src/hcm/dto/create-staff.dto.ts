import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsOptional,
  Min,
  IsEmail,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateStaffDto {
  @ApiProperty({ description: 'User account ID to link this staff record to' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'Department ID' })
  @IsString()
  @IsNotEmpty()
  departmentId: string;

  @ApiProperty({ description: 'Position ID' })
  @IsString()
  @IsNotEmpty()
  positionId: string;

  @ApiProperty({ example: 'EMP-0042' })
  @IsString()
  @IsNotEmpty()
  employeeNumber: string;

  @ApiProperty({ example: 'Jane' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'jane.doe@hotel.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+1-555-000-9876' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: '2024-01-15', description: 'Hire date (ISO 8601)' })
  @IsDateString()
  hireDate: string;

  @ApiProperty({ example: 45000.00, description: 'Annual base salary' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  baseSalary: number;

  @ApiPropertyOptional({ example: '0012-3456-7890' })
  @IsOptional()
  @IsString()
  bankAccountNo?: string;

  @ApiPropertyOptional({ description: 'Emergency contact JSON object' })
  @IsOptional()
  emergencyContact?: any;
}
