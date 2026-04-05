import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  Min,
  IsPositive,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateReservationDto {
  @ApiPropertyOptional({ description: 'Guest profile ID (optional for walk-ins)' })
  @IsOptional()
  @IsString()
  guestProfileId?: string;

  @ApiProperty({ description: 'Room type ID for the reservation' })
  @IsString()
  @IsNotEmpty()
  roomTypeId: string;

  @ApiProperty({ example: '2025-09-01', description: 'Check-in date (ISO 8601)' })
  @IsDateString()
  checkInDate: Date;

  @ApiProperty({ example: '2025-09-05', description: 'Check-out date (ISO 8601)' })
  @IsDateString()
  checkOutDate: Date;

  @ApiProperty({ example: 2, default: 1, description: 'Number of adults' })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  adults: number = 1;

  @ApiProperty({ example: 0, default: 0, description: 'Number of children' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  children: number = 0;

  @ApiPropertyOptional({ example: 'BAR', description: 'Rate code applied' })
  @IsOptional()
  @IsString()
  rateCode?: string;

  @ApiProperty({ example: 250.00, description: 'Nightly rate amount' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  rateAmount: number;

  @ApiPropertyOptional({ example: 'Late check-in requested around 23:00' })
  @IsOptional()
  @IsString()
  specialRequests?: string;

  @ApiProperty({ example: 'DIRECT', default: 'DIRECT', description: 'Booking source channel' })
  @IsString()
  source: string = 'DIRECT';

  @ApiPropertyOptional({ example: '23:00', description: 'Expected arrival time (HH:mm)' })
  @IsOptional()
  @IsString()
  arrivalTime?: string;
}
