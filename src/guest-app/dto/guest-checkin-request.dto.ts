import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GuestCheckinRequestDto {
  @ApiProperty({ description: 'Booking confirmation number' })
  @IsString()
  @IsNotEmpty()
  confirmationNo: string;

  @ApiProperty({ description: 'Guest last name (used for identity verification)' })
  @IsString()
  @IsNotEmpty()
  lastName: string;
}
