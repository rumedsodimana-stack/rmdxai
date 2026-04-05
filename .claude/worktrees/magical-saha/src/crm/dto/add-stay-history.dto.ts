import { IsString, IsNotEmpty, IsDateString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AddStayHistoryDto {
  @ApiProperty({ description: 'Reservation ID to link to the guest profile' })
  @IsString()
  @IsNotEmpty()
  reservationId: string;

  @ApiPropertyOptional({ description: 'Points earned for this stay' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  pointsEarned?: number;
}
