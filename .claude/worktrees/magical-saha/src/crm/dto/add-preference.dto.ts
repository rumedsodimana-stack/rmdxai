import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddPreferenceDto {
  @ApiProperty({ example: 'pillow', description: 'Preference category (room, pillow, temperature, dietary, etc.)' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ example: 'Extra firm pillow' })
  @IsString()
  @IsNotEmpty()
  preference: string;

  @ApiPropertyOptional({ example: 'Requested every stay since 2022' })
  @IsOptional()
  @IsString()
  notes?: string;
}
