import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GuestMessageDto {
  @ApiProperty({ description: 'Message content from guest to front desk' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
