import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsDateString,
  IsNotEmpty,
  ValidateNested,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GoodsReceiptLineDto {
  @ApiProperty({ description: 'Inventory item ID' })
  @IsString()
  @IsNotEmpty()
  inventoryItemId: string;

  @ApiProperty({ description: 'Quantity received' })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  quantity: number;

  @ApiProperty({ description: 'Actual unit cost on delivery' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitCost: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReceiveGoodsDto {
  @ApiProperty({ description: 'Date goods were physically received (ISO 8601)' })
  @IsDateString()
  receivedDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [GoodsReceiptLineDto], description: 'Items received with quantities and costs' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GoodsReceiptLineDto)
  items: GoodsReceiptLineDto[];
}
