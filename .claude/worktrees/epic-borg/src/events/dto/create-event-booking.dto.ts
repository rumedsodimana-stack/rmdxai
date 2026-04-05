import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsDateString,
  IsArray,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateEventBookingDto {
  @ApiPropertyOptional({ description: 'Guest profile ID of the organizer' })
  @IsOptional()
  @IsString()
  guestProfileId?: string;

  @ApiProperty({ description: 'Organizer full name' })
  @IsString()
  @IsNotEmpty()
  organizerName: string;

  @ApiProperty({ description: 'Organizer email address' })
  @IsString()
  @IsNotEmpty()
  organizerEmail: string;

  @ApiPropertyOptional({ description: 'Organizer phone number' })
  @IsOptional()
  @IsString()
  organizerPhone?: string;

  @ApiProperty({ description: 'Name of the event', example: 'Annual Tech Summit 2026' })
  @IsString()
  @IsNotEmpty()
  eventName: string;

  @ApiProperty({
    description: 'Event type',
    example: 'conference',
    enum: ['wedding', 'conference', 'gala', 'meeting', 'workshop', 'birthday', 'other'],
  })
  @IsString()
  @IsNotEmpty()
  eventType: string;

  @ApiProperty({ description: 'Event start date/time (ISO 8601)' })
  @IsDateString()
  startDateTime: string;

  @ApiProperty({ description: 'Event end date/time (ISO 8601)' })
  @IsDateString()
  endDateTime: string;

  @ApiProperty({ description: 'Expected attendee count' })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  attendeesCount: number;

  @ApiPropertyOptional({ isArray: true, description: 'Venue room names/codes to reserve' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  venueRooms?: string[];

  @ApiPropertyOptional({ description: 'Total contracted amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalAmount?: number = 0;

  @ApiPropertyOptional({ description: 'Deposit amount required' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  depositAmount?: number = 0;

  @ApiPropertyOptional({ description: 'Whether deposit has been received' })
  @IsOptional()
  @IsBoolean()
  depositPaid?: boolean = false;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
