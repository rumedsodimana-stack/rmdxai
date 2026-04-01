import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  IsPositive,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateRoomTypeDto {
  @ApiProperty({ example: 'DLX-KG', description: 'Unique room type code' })
  @IsString()
  @MaxLength(20)
  code: string;

  @ApiProperty({ example: 'Deluxe King', description: 'Room type display name' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Spacious king room with city view' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 2, description: 'Maximum number of occupants' })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  maxOccupancy: number;

  @ApiProperty({ example: 250.00, description: 'Base nightly rate' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  baseRate: number;

  @ApiProperty({ example: ['WiFi', 'Mini-bar', 'Safe'], description: 'List of amenities' })
  @IsArray()
  @IsString({ each: true })
  amenities: string[];

  @ApiProperty({ example: 'King', description: 'Bed type (e.g., King, Twin, Double)' })
  @IsString()
  bedType: string;

  @ApiPropertyOptional({ example: 42.5, description: 'Room size in square metres' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  sizeSqm?: number;
}
