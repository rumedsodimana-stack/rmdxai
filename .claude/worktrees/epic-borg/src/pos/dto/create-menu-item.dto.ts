import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  Min,
  IsPositive,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateMenuItemDto {
  @ApiProperty({ description: 'ID of the outlet this item belongs to' })
  @IsString()
  @IsNotEmpty()
  outletId: string;

  @ApiProperty({ example: 'Grilled Salmon', description: 'Menu item name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 'Atlantic salmon, lemon butter, seasonal vegetables' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Main Course', description: 'Menu category' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({ example: 'Seafood', description: 'Sub-category within the category' })
  @IsOptional()
  @IsString()
  subCategory?: string;

  @ApiProperty({ example: 42.00, description: 'Selling price' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @ApiProperty({ example: 10, default: 0, description: 'Tax rate percentage applied to this item' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  taxRate: number = 0;

  @ApiProperty({ example: false, description: 'Is the item vegetarian?' })
  @IsBoolean()
  isVegetarian: boolean;

  @ApiProperty({ example: ['gluten', 'dairy'], description: 'List of allergen codes' })
  @IsArray()
  @IsString({ each: true })
  allergens: string[];

  @ApiPropertyOptional({ example: 15, description: 'Estimated preparation time in minutes' })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  prepTimeMin?: number;

  @ApiPropertyOptional({ example: 10, description: 'Display order within the category' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;
}
