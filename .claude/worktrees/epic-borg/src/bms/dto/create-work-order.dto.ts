import {
  IsString,
  IsOptional,
  IsNumber,
  IsNotEmpty,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateWorkOrderDto {
  @ApiPropertyOptional({ description: 'Maintenance request that originated this work order' })
  @IsOptional()
  @IsString()
  maintenanceRequestId?: string;

  @ApiPropertyOptional({ description: 'Preventive maintenance schedule that triggered this order' })
  @IsOptional()
  @IsString()
  pmScheduleId?: string;

  @ApiPropertyOptional({ description: 'Asset to be serviced' })
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiPropertyOptional({ description: 'Room associated with this work order' })
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiProperty({ example: 'Replace HVAC filter — Room 305' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'AC unit reported not cooling. Filter replacement and refrigerant check required.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'User ID of the technician assigned to this order' })
  @IsString()
  @IsNotEmpty()
  assignedToId: string;

  @ApiPropertyOptional({ example: 90, description: 'Estimated labour time in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  laborMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
