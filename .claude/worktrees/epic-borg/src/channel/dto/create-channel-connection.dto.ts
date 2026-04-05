import { IsString, IsBoolean, IsOptional, IsObject, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChannelProvider } from '@prisma/client';

export class CreateChannelConnectionDto {
  @ApiProperty({
    enum: ChannelProvider,
    description: 'OTA / distribution channel provider',
  })
  @IsEnum(ChannelProvider)
  provider: ChannelProvider;

  @ApiProperty({ description: "Property's hotel ID on the OTA platform" })
  @IsString()
  @IsNotEmpty()
  hotelId: string;

  @ApiProperty({
    description: 'API credentials (keys, tokens, secrets) — stored encrypted at rest',
    type: 'object',
  })
  @IsObject()
  credentials: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Whether the connection is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
