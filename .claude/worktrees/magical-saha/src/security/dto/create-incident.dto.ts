import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncidentSeverity } from '@prisma/client';

export class CreateIncidentDto {
  @ApiProperty({ example: 'Unauthorised access attempt at pool area' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'At 23:42 a guest attempted to access the pool area after closing. Security escorted the individual back to their room.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ enum: IncidentSeverity, example: IncidentSeverity.MEDIUM })
  @IsEnum(IncidentSeverity)
  severity: IncidentSeverity;

  @ApiPropertyOptional({ example: 'Pool area — Gate B' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ description: 'Guest profile ID if a guest is involved' })
  @IsOptional()
  @IsString()
  guestProfileId?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['Jane Doe (Room 212)', 'Security Officer A. Mensah'],
    description: 'Names of witnesses',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  witnessNames?: string[];
}
