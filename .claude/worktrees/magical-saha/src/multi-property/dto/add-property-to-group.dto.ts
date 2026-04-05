import { IsString, IsOptional, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddPropertyToGroupDto {
  @ApiProperty({ description: 'Property ID to add to the group' })
  @IsString()
  @IsNotEmpty()
  propertyId: string;

  @ApiPropertyOptional({ enum: ['member', 'flagship', 'hub'], default: 'member' })
  @IsOptional()
  @IsIn(['member', 'flagship', 'hub'])
  role?: string = 'member';
}
