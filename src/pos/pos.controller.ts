import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

import { PosService } from './pos.service';
import { CreateOutletDto } from './dto/create-outlet.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { SettleBillDto } from './dto/settle-bill.dto';
import { VoidOrderDto } from './dto/void-order.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PropertyId } from '../../common/decorators/property-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('pos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pos')
export class PosController {
  constructor(private readonly posService: PosService) {}

  // ─────────────────────────────────────────────────────────
  //  OUTLETS
  // ─────────────────────────────────────────────────────────

  @Post('outlets')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Create a new outlet (restaurant, bar, etc.)' })
  createOutlet(@PropertyId() propertyId: string, @Body() dto: CreateOutletDto) {
    return this.posService.createOutlet(propertyId, dto);
  }

  @Get('outlets')
  @ApiOperation({ summary: 'List all active outlets for this property' })
  listOutlets(@PropertyId() propertyId: string) {
    return this.posService.listOutlets(propertyId);
  }

  @Patch('outlets/:id')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Update an outlet' })
  updateOutlet(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateOutletDto>,
  ) {
    return this.posService.updateOutlet(propertyId, id, dto);
  }

  // ─────────────────────────────────────────────────────────
  //  MENU ITEMS
  // ─────────────────────────────────────────────────────────

  @Get('menu-items')
  @ApiOperation({ summary: 'List available menu items, optionally filtered by outlet and category' })
  @ApiQuery({ name: 'outletId', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String })
  getMenuItems(
    @PropertyId() propertyId: string,
    @Query('outletId') outletId?: string,
    @Query('category') category?: string,
  ) {
    return this.posService.getMenuItems(propertyId, outletId, category);
  }

  @Post('menu-items')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Create a new menu item' })
  createMenuItem(@PropertyId() propertyId: string, @Body() dto: CreateMenuItemDto) {
    return this.posService.createMenuItem(propertyId, dto);
  }

  @Patch('menu-items/:id')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Update a menu item' })
  updateMenuItem(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateMenuItemDto>,
  ) {
    return this.posService.updateMenuItem(propertyId, id, dto);
  }

  @Patch('menu-items/:id/toggle')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Toggle menu item availability (86 / un-86)' })
  toggleMenuItemAvailability(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.posService.toggleMenuItemAvailability(propertyId, id);
  }

  // ─────────────────────────────────────────────────────────
  //  ORDERS
  // ─────────────────────────────────────────────────────────

  @Post('orders')
  @ApiOperation({ summary: 'Create a new POS order and open a bill' })
  createOrder(@PropertyId() propertyId: string, @Body() dto: CreateOrderDto) {
    return this.posService.createOrder(propertyId, dto);
  }

  @Get('orders')
  @ApiOperation({ summary: 'List orders with optional filters' })
  @ApiQuery({ name: 'outletId', required: false, type: String })
  @ApiQuery({ name: 'status', enum: OrderStatus, required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listOrders(
    @PropertyId() propertyId: string,
    @Query('outletId') outletId?: string,
    @Query('status') status?: OrderStatus,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.posService.listOrders(propertyId, { outletId, status, skip, take });
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get a single order with items and bill' })
  getOrder(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.posService.getOrder(propertyId, id);
  }

  @Patch('orders/:id/status')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF')
  @ApiOperation({ summary: 'Update order status (confirm, in progress, ready, delivered)' })
  updateOrderStatus(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.posService.updateOrderStatus(propertyId, id, dto, user.id);
  }

  @Post('orders/:id/void')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Void an order and its bill' })
  voidOrder(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: VoidOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.posService.voidOrder(propertyId, id, dto.reason, user.id);
  }

  @Post('orders/:id/settle')
  @Roles('GM', 'ADMIN', 'FINANCE', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Settle an order bill (cash, card, room charge, etc.)' })
  settleBill(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: SettleBillDto,
    @CurrentUser() user: any,
  ) {
    return this.posService.settleBill(propertyId, id, dto, user.id);
  }

  @Post('orders/:id/split')
  @Roles('GM', 'ADMIN', 'FINANCE', 'DEPT_MANAGER', 'SUPERVISOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Split a bill across multiple payment methods or payers' })
  splitBill(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body('splits') splits: { amount: number; paymentMethod: string }[],
  ) {
    return this.posService.splitBill(propertyId, id, splits);
  }

  @Post('orders/:id/comp')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Comp (complimentary) an order — marks bill as paid with 0 amount' })
  compOrder(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
  ) {
    return this.posService.compOrder(propertyId, id, reason, user.id);
  }

  // ─────────────────────────────────────────────────────────
  //  REPORTS
  // ─────────────────────────────────────────────────────────

  @Get('summary')
  @Roles('GM', 'ADMIN', 'FINANCE', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Daily POS summary: order count, revenue, outlet breakdown, top 5 items' })
  @ApiQuery({ name: 'date', required: true, type: String, example: '2025-09-01' })
  getDailySummary(@PropertyId() propertyId: string, @Query('date') date: string) {
    return this.posService.getDailySummary(propertyId, date);
  }
}
