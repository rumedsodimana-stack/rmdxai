import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateGuestProfileDto } from './create-guest-profile.dto';

export class UpdateGuestProfileDto extends PartialType(CreateGuestProfileDto) {
  @ApiPropertyOptional({ description: 'Mark guest as VIP' })
  @IsOptional()
  @IsBoolean()
  isVip?: boolean;

  @ApiPropertyOptional({ description: 'Reason for VIP status' })
  @IsOptional()
  @IsString()
  vipReason?: string;
}
