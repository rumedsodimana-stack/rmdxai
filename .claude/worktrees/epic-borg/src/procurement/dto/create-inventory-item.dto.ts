import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateInventoryItemDto {
  @ApiPropertyOptional({ description: 'Preferred supplier ID' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiProperty({ description: 'Stock-keeping unit code', example: 'LINEN-KING-WHITE' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiProperty({ description: 'Item name', example: 'King Bed Sheet Set (White)' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Item category', example: 'linen' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({ default: 'each', description: 'Unit of measure (each, kg, litre, box…)' })
  @IsOptional()
  @IsString()
  unit?: string = 'each';

  @ApiProperty({ description: 'Stock level at which reorder is triggered' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  reorderPoint: number;

  @ApiProperty({ description: 'Quantity to order when reorder point is reached' })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  reorderQty: number;

  @ApiProperty({ description: 'Unit purchase cost' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitCost: number;
}
