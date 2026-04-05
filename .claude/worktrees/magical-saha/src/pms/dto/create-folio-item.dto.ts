import { IsString, IsOptional, IsNumber, Min, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateFolioItemDto {
  @ApiProperty({ example: 'Room charge — Deluxe King, night of 2025-09-01' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 1, default: 1, description: 'Number of units' })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity: number = 1;

  @ApiProperty({ example: 250.00, description: 'Price per unit' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice: number;

  @ApiPropertyOptional({ example: 30.00, description: 'Tax amount applied to this line item' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  taxAmount?: number;

  @ApiPropertyOptional({ example: 'ROOM_CHARGE', description: 'Type of the originating reference' })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({ example: 'uuid-of-reservation', description: 'ID of the originating record' })
  @IsOptional()
  @IsString()
  referenceId?: string;
}
