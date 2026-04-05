import {
  IsString,
  IsOptional,
  IsArray,
  IsNotEmpty,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ description: 'Array of recipient user IDs' })
  @IsArray()
  @IsString({ each: true })
  recipientIds: string[];

  @ApiPropertyOptional({ description: 'Message subject line' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ description: 'Message body content' })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiPropertyOptional({ enum: ['normal', 'urgent', 'low'], default: 'normal' })
  @IsOptional()
  @IsIn(['normal', 'urgent', 'low'])
  priority?: string = 'normal';

  @ApiPropertyOptional({ description: 'Parent message ID for threading' })
  @IsOptional()
  @IsString()
  parentId?: string;
}
