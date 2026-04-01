import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VoidOrderDto {
  @ApiProperty({ example: 'Customer left without ordering', description: 'Reason for voiding the order' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
