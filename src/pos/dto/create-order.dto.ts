import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsPositive,
  IsNotEmpty,
  ValidateNested,
  ArrayMinSize,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrderItemDto {
  @ApiProperty({ description: 'Menu item ID' })
  @IsString()
  @IsNotEmpty()
  menuItemId: string;

  @ApiProperty({ example: 2, description: 'Quantity ordered' })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  quantity: number;

  @ApiPropertyOptional({ example: ['Extra cheese', 'No onion'], description: 'Item modifiers' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modifiers?: string[];

  @ApiPropertyOptional({ example: 'Allergy to nuts' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateOrderDto {
  @ApiProperty({ description: 'ID of the outlet handling the order' })
  @IsString()
  @IsNotEmpty()
  outletId: string;

  @ApiPropertyOptional({ description: 'Guest profile ID if the order is linked to a guest' })
  @IsOptional()
  @IsString()
  guestProfileId?: string;

  @ApiPropertyOptional({ example: '201', description: 'Room number for room-service orders' })
  @IsOptional()
  @IsString()
  roomNumber?: string;

  @ApiPropertyOptional({ example: 'T12', description: 'Table identifier for dine-in orders' })
  @IsOptional()
  @IsString()
  tableNumber?: string;

  @ApiProperty({
    example: 'dine_in',
    default: 'dine_in',
    description: 'Order type: dine_in | takeaway | room_service | delivery',
  })
  @IsString()
  type: string = 'dine_in';

  @ApiPropertyOptional({ example: 'Please bring extra napkins' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [OrderItemDto], description: 'Line items in the order' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
