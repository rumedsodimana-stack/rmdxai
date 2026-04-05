import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ServiceRequestDto {
  @ApiProperty({
    description: 'Category of service request',
    example: 'housekeeping',
    enum: ['housekeeping', 'maintenance', 'f&b', 'concierge', 'transport', 'other'],
  })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ description: 'Short title for the request', example: 'Extra towels needed' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Full description of the request' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' })
  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: string = 'normal';

  @ApiPropertyOptional({ description: 'Associated reservation ID' })
  @IsOptional()
  @IsString()
  reservationId?: string;
}
