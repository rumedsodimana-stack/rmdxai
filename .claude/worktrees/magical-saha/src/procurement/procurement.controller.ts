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
import { PurchaseOrderStatus } from '@prisma/client';

import { ProcurementService } from './procurement.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceiveGoodsDto } from './dto/receive-goods.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PropertyId } from '../../common/decorators/property-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('procurement')
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  // ─────────────────────────────────────────────────────────
  //  SUPPLIERS
  // ─────────────────────────────────────────────────────────

  @Post('suppliers')
  @Roles('GM', 'ADMIN', 'FINANCE', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Create a new supplier' })
  createSupplier(@PropertyId() propertyId: string, @Body() dto: CreateSupplierDto) {
    return this.procurementService.createSupplier(propertyId, dto);
  }

  @Get('suppliers')
  @ApiOperation({ summary: 'List active suppliers' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listSuppliers(
    @PropertyId() propertyId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.procurementService.listSuppliers(propertyId, skip, take);
  }

  @Get('suppliers/:id')
  @ApiOperation({ summary: 'Get a supplier with purchase order history' })
  getSupplier(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.procurementService.getSupplier(propertyId, id);
  }

  @Patch('suppliers/:id')
  @Roles('GM', 'ADMIN', 'FINANCE', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Update a supplier' })
  updateSupplier(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateSupplierDto>,
  ) {
    return this.procurementService.updateSupplier(propertyId, id, dto);
  }

  @Post('suppliers/:id/deactivate')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a supplier' })
  deactivateSupplier(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.procurementService.deactivateSupplier(propertyId, id);
  }

  // ─────────────────────────────────────────────────────────
  //  INVENTORY ITEMS
  // ─────────────────────────────────────────────────────────

  @Post('inventory')
  @Roles('GM', 'ADMIN', 'FINANCE', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Create an inventory item with stock tracking' })
  createInventoryItem(
    @PropertyId() propertyId: string,
    @Body() dto: CreateInventoryItemDto,
  ) {
    return this.procurementService.createInventoryItem(propertyId, dto);
  }

  @Get('inventory')
  @ApiOperation({ summary: 'List inventory items, optionally filtered by category or below reorder' })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'belowReorder', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listInventoryItems(
    @PropertyId() propertyId: string,
    @Query('category') category?: string,
    @Query('belowReorder') belowReorder?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.procurementService.listInventoryItems(propertyId, {
      category,
      belowReorder: belowReorder === 'true',
      skip,
      take,
    });
  }

  @Get('inventory/reorder-alerts')
  @Roles('GM', 'ADMIN', 'FINANCE', 'DEPT_MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Get all items below their minimum stock / reorder point' })
  getReorderAlerts(@PropertyId() propertyId: string) {
    return this.procurementService.getReorderAlerts(propertyId);
  }

  @Get('inventory/:id')
  @ApiOperation({ summary: 'Get a single inventory item with purchase history' })
  getInventoryItem(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.procurementService.getInventoryItem(propertyId, id);
  }

  @Patch('inventory/:id')
  @Roles('GM', 'ADMIN', 'FINANCE', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Update an inventory item' })
  updateInventoryItem(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateInventoryItemDto>,
  ) {
    return this.procurementService.updateInventoryItem(propertyId, id, dto);
  }

  // ─────────────────────────────────────────────────────────
  //  PURCHASE ORDERS
  // ─────────────────────────────────────────────────────────

  @Post('purchase-orders')
  @Roles('GM', 'ADMIN', 'FINANCE', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Create a new purchase order (starts as DRAFT)' })
  createPurchaseOrder(
    @PropertyId() propertyId: string,
    @CurrentUser() user: any,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.procurementService.createPurchaseOrder(propertyId, user.id, dto);
  }

  @Get('purchase-orders')
  @ApiOperation({ summary: 'List purchase orders with optional filters' })
  @ApiQuery({ name: 'status', enum: PurchaseOrderStatus, required: false })
  @ApiQuery({ name: 'supplierId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listPurchaseOrders(
    @PropertyId() propertyId: string,
    @Query('status') status?: PurchaseOrderStatus,
    @Query('supplierId') supplierId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.procurementService.listPurchaseOrders(propertyId, { status, supplierId, skip, take });
  }

  @Get('purchase-orders/:id')
  @ApiOperation({ summary: 'Get a purchase order with line items and goods receipts' })
  getPurchaseOrder(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.procurementService.getPurchaseOrder(propertyId, id);
  }

  @Post('purchase-orders/:id/submit')
  @Roles('GM', 'ADMIN', 'FINANCE', 'DEPT_MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a DRAFT purchase order for approval' })
  submitPurchaseOrder(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.procurementService.submitPurchaseOrder(propertyId, id);
  }

  @Post('purchase-orders/:id/approve')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a SUBMITTED purchase order' })
  approvePurchaseOrder(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.procurementService.approvePurchaseOrder(propertyId, id, user.id);
  }

  @Post('purchase-orders/:id/cancel')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a purchase order' })
  cancelPurchaseOrder(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.procurementService.cancelPurchaseOrder(propertyId, id);
  }

  // ─────────────────────────────────────────────────────────
  //  GOODS RECEIPT
  // ─────────────────────────────────────────────────────────

  @Post('purchase-orders/:id/receive')
  @Roles('GM', 'ADMIN', 'FINANCE', 'DEPT_MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Receive goods against a purchase order — updates stock levels' })
  receiveGoods(
    @PropertyId() propertyId: string,
    @Param('id') purchaseOrderId: string,
    @CurrentUser() user: any,
    @Body() dto: ReceiveGoodsDto,
  ) {
    return this.procurementService.receiveGoods(propertyId, purchaseOrderId, user.id, dto);
  }
}
