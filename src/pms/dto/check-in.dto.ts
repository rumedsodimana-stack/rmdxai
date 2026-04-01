import { IsString, IsOptional, IsDateString, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckInDto {
  @ApiProperty({ description: 'ID of the room being assigned for check-in' })
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @ApiPropertyOptional({
    example: '2025-09-01T14:30:00.000Z',
    description: 'Actual check-in datetime (defaults to now if omitted)',
  })
  @IsOptional()
  @IsDateString()
  actualCheckIn?: Date;
}
