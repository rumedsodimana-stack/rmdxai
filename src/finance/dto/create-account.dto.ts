import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';

export class CreateAccountDto {
  @ApiProperty({ description: 'Unique account code (e.g. 1001, 4100)', example: '1001' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ description: 'Account name', example: 'Cash at Bank' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: AccountType, description: 'Account classification' })
  @IsEnum(AccountType)
  type: AccountType;

  @ApiPropertyOptional({ description: 'Parent account ID for hierarchical chart of accounts' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Optional description of the account' })
  @IsOptional()
  @IsString()
  description?: string;
}
