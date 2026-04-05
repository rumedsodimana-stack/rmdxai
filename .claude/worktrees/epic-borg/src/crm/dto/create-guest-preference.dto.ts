import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGuestPreferenceDto {
  @ApiProperty({
    description: 'Preference category: room, pillow, temperature, dietary, transport, etc.',
    example: 'room',
  })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ description: 'Specific preference value', example: 'high floor' })
  @IsString()
  @IsNotEmpty()
  preference: string;

  @ApiPropertyOptional({ description: 'Additional notes about this preference' })
  @IsOptional()
  @IsString()
  notes?: string;
}
