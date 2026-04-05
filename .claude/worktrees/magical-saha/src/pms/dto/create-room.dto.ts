import { IsString, IsNumber, IsOptional, IsPositive, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateRoomDto {
  @ApiProperty({ example: 'uuid-of-room-type', description: 'ID of the room type' })
  @IsString()
  roomTypeId: string;

  @ApiProperty({ example: '101', description: 'Room number' })
  @IsString()
  @MaxLength(20)
  number: string;

  @ApiProperty({ example: 1, description: 'Floor number' })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  floor: number;

  @ApiPropertyOptional({ example: 'Corner room, extra quiet' })
  @IsOptional()
  @IsString()
  notes?: string;
}
