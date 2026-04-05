import {
  IsString,
  IsOptional,
  IsIn,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LogAccessDto {
  @ApiProperty({ example: 'Main Entrance — Gate 1', description: 'Physical location of the access point' })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({
    example: 'entry',
    description: 'Type of access event: entry | exit | denied',
  })
  @IsIn(['entry', 'exit', 'denied'])
  accessType: string;

  @ApiProperty({
    example: 'key_card',
    description: 'Authentication method: key_card | pin | biometric | manual',
  })
  @IsIn(['key_card', 'pin', 'biometric', 'manual'])
  method: string;

  @ApiPropertyOptional({ example: 'KC-0042-A', description: 'Key card number used (if applicable)' })
  @IsOptional()
  @IsString()
  cardNumber?: string;

  @ApiPropertyOptional({ description: 'User ID of the staff member (leave null for guests using key cards)' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ example: 'Access denied — card expired' })
  @IsOptional()
  @IsString()
  notes?: string;
}
