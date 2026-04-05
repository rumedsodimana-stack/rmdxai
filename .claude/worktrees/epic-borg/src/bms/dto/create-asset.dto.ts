import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsNotEmpty,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateAssetDto {
  @ApiProperty({ example: 'Main Lobby HVAC Unit A', description: 'Descriptive asset name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'HVAC-001', description: 'Unique asset tag / barcode' })
  @IsString()
  @IsNotEmpty()
  assetTag: string;

  @ApiProperty({
    example: 'hvac',
    description: 'Category: hvac | elevator | electrical | plumbing | furniture | it | kitchen | fire_safety | other',
  })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ example: 'Ground Floor — Lobby', description: 'Physical location in the property' })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiPropertyOptional({ example: 'Daikin' })
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiPropertyOptional({ example: 'VRV-IV 28kW' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ example: 'DK-2024-00123' })
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional({ example: '2022-03-15' })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({ example: 18500.00 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  purchaseCost?: number;

  @ApiPropertyOptional({ example: '2027-03-15' })
  @IsOptional()
  @IsDateString()
  warrantyExpiry?: string;

  @ApiPropertyOptional({ example: '2025-10-01', description: 'Next scheduled service date' })
  @IsOptional()
  @IsDateString()
  nextServiceDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
