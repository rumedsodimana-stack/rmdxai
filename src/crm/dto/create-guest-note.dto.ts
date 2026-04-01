import { IsString, IsBoolean, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGuestNoteDto {
  @ApiProperty({
    description: 'Note type: general, complaint, compliment, request, incident',
    example: 'general',
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'Note content' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Private notes are only visible to managers', default: false })
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean = false;
}
