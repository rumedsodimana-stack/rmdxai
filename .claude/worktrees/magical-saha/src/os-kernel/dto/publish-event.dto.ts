import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublishEventDto {
  @ApiProperty({ description: 'Event type (e.g. reservation.checkin, room.status_changed)', example: 'reservation.checkin' })
  @IsString()
  @IsNotEmpty()
  eventType: string;

  @ApiProperty({ description: 'Entity type the event pertains to', example: 'reservation' })
  @IsString()
  @IsNotEmpty()
  entityType: string;

  @ApiProperty({ description: 'Entity ID', example: 'uuid' })
  @IsString()
  @IsNotEmpty()
  entityId: string;

  @ApiProperty({ description: 'Event payload (free-form JSON)' })
  @IsObject()
  payload: Record<string, any>;

  @ApiPropertyOptional({ description: 'User ID publishing the event' })
  @IsOptional()
  @IsString()
  publishedBy?: string;
}
