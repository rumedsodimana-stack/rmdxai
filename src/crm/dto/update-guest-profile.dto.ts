import { PartialType } from '@nestjs/swagger';
import { CreateGuestProfileDto } from './create-guest-profile.dto';

export class UpdateGuestProfileDto extends PartialType(CreateGuestProfileDto) {}
