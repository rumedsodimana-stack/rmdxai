import {
  IsString,
  IsEmail,
  IsOptional,
  IsDateString,
  IsNotEmpty,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGuestProfileDto {
  @ApiProperty({ description: "Guest's first name" })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  firstName: string;

  @ApiProperty({ description: "Guest's last name" })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  lastName: string;

  @ApiPropertyOptional({ description: "Guest's email address" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: "Guest's phone number (with country code)" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Nationality (country code or name)' })
  @IsOptional()
  @IsString()
  nationality?: string;

  @ApiPropertyOptional({ description: 'Passport number' })
  @IsOptional()
  @IsString()
  passportNo?: string;

  @ApiPropertyOptional({ description: 'Passport expiry date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  passportExpiry?: Date;

  @ApiPropertyOptional({ description: 'Date of birth (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: Date;

  @ApiPropertyOptional({ description: 'Street address' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: 'City of residence' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Country of residence' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Preferred communication language (ISO 639-1)', default: 'en' })
  @IsOptional()
  @IsString()
  language?: string = 'en';
}
