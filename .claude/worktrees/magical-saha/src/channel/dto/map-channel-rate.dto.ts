import { IsString, IsNumber, IsOptional, IsNotEmpty, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class MapChannelRateDto {
  @ApiProperty({ description: 'ID of the channel connection to map the rate to' })
  @IsString()
  @IsNotEmpty()
  channelConnectionId: string;

  @ApiProperty({ description: 'ID of the internal rate plan' })
  @IsString()
  @IsNotEmpty()
  ratePlanId: string;

  @ApiProperty({ description: "Channel's rate code identifier on the OTA platform" })
  @IsString()
  @IsNotEmpty()
  channelRateCode: string;

  @ApiPropertyOptional({
    description: 'Markup percentage to add on top of base rate when pushing to channel (0 = no markup)',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  markup?: number = 0;
}
