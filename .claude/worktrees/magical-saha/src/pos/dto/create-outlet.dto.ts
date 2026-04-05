import { IsString, IsOptional, MaxLength, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOutletDto {
  @ApiProperty({ example: 'The Terrace', description: 'Outlet name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'restaurant',
    description: 'Outlet type (restaurant, bar, room_service, spa, pool_bar, etc.)',
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({ example: 'Ground Floor, West Wing' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: '07:00', description: 'Opening time (HH:mm)' })
  @IsOptional()
  @IsString()
  openTime?: string;

  @ApiPropertyOptional({ example: '22:00', description: 'Closing time (HH:mm)' })
  @IsOptional()
  @IsString()
  closeTime?: string;
}
