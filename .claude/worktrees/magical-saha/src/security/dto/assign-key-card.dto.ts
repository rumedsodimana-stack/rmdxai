import {
  IsString,
  IsOptional,
  IsDateString,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignKeyCardDto {
  @ApiProperty({ example: 'KC-0042-A', description: 'Physical key card number / barcode' })
  @IsString()
  @IsNotEmpty()
  cardNumber: string;

  @ApiPropertyOptional({ description: 'Room the card grants access to (required for guest cards)' })
  @IsOptional()
  @IsString()
  roomId?: string;

  @ApiPropertyOptional({ description: 'Guest profile the card is issued to (required for guest cards)' })
  @IsOptional()
  @IsString()
  guestProfileId?: string;

  @ApiProperty({
    example: '2025-09-05T12:00:00Z',
    description: 'Card expiry — must be set to guest check-out date/time',
  })
  @IsDateString()
  expiresAt: string;

  @ApiPropertyOptional({ example: 'Replacement card — original lost' })
  @IsOptional()
  @IsString()
  notes?: string;
}
