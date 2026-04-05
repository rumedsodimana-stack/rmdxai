import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaintenancePriority } from '@prisma/client';

export class CreateMaintenanceRequestDto {
  @ApiPropertyOptional({ description: 'Asset ID this request relates to (optional)' })
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiPropertyOptional({ description: 'Room ID if this is a room-related fault (optional)' })
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiProperty({ example: 'AC unit not cooling in Room 305' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'The AC in room 305 stopped cooling after 14:00. Guest complained of heat.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ enum: MaintenancePriority, example: MaintenancePriority.HIGH })
  @IsEnum(MaintenancePriority)
  priority: MaintenancePriority;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://cdn.example.com/img/fault-305.jpg'],
    description: 'URLs of supporting photos',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];
}
