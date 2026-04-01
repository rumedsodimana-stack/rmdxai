import {
  IsString,
  IsArray,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsNotEmpty,
  Min,
  ArrayMinSize,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SyncAvailabilityDto {
  @ApiProperty({ description: 'ID of the room type to update availability for' })
  @IsString()
  @IsNotEmpty()
  roomTypeId: string;

  @ApiProperty({
    description: 'Array of dates in YYYY-MM-DD format to update',
    type: [String],
    example: ['2025-12-24', '2025-12-25'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    each: true,
    message: 'Each date must be in YYYY-MM-DD format',
  })
  dates: string[];

  @ApiProperty({ description: 'Number of rooms available for the given dates' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  availableRooms: number;

  @ApiProperty({ description: 'Rate to publish for the given dates' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  rate: number;

  @ApiPropertyOptional({ description: 'Whether the room type is closed for these dates', default: false })
  @IsOptional()
  @IsBoolean()
  isClosed?: boolean = false;

  @ApiPropertyOptional({ description: 'Minimum length of stay restriction' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  minLOS?: number;

  @ApiPropertyOptional({ description: 'Maximum length of stay restriction' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  maxLOS?: number;
}
