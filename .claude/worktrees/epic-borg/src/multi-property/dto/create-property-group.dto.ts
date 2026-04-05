import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePropertyGroupDto {
  @ApiProperty({ description: 'Property group name', example: 'Singularity Portfolio' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Group description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Head office location / address' })
  @IsOptional()
  @IsString()
  headOffice?: string;
}
