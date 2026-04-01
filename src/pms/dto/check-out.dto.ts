import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CheckOutDto {
  @ApiPropertyOptional({
    example: '2025-09-05T11:00:00.000Z',
    description: 'Actual check-out datetime (defaults to now if omitted)',
  })
  @IsOptional()
  @IsDateString()
  actualCheckOut?: Date;
}
