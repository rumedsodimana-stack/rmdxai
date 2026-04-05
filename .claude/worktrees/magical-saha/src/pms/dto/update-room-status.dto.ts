import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomStatus } from '@prisma/client';

export class UpdateRoomStatusDto {
  @ApiProperty({ enum: RoomStatus, description: 'New room status' })
  @IsEnum(RoomStatus)
  status: RoomStatus;

  @ApiPropertyOptional({ example: 'Plumbing repair in progress' })
  @IsOptional()
  @IsString()
  oooReason?: string;

  @ApiPropertyOptional({ example: '2025-06-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  oooFrom?: Date;

  @ApiPropertyOptional({ example: '2025-06-03T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  oooUntil?: Date;
}
