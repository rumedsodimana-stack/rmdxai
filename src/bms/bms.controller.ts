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
import { AssetStatus, MaintenanceRequestStatus, MaintenancePriority, WorkOrderStatus } from '@prisma/client';

import { BmsService } from './bms.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { CreateMaintenanceRequestDto } from './dto/create-maintenance-request.dto';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PropertyId } from '../../common/decorators/property-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('bms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bms')
export class BmsController {
  constructor(private readonly bmsService: BmsService) {}

  // ─────────────────────────────────────────────────────────
  //  ASSETS
  // ─────────────────────────────────────────────────────────

  @Post('assets')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Register a new asset' })
  createAsset(@PropertyId() propertyId: string, @Body() dto: CreateAssetDto) {
    return this.bmsService.createAsset(propertyId, dto);
  }

  @Get('assets')
  @ApiOperation({ summary: 'List assets with optional filters' })
  @ApiQuery({ name: 'category', required: false, type: String })
  @ApiQuery({ name: 'status', enum: AssetStatus, required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listAssets(
    @PropertyId() propertyId: string,
    @Query('category') category?: string,
    @Query('status') status?: AssetStatus,
    @Query('page') page = '1',
    @Query('limit') limit = '30',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.bmsService.listAssets(propertyId, { category, status, skip, take });
  }

  @Get('assets/:id')
  @ApiOperation({ summary: 'Get a single asset with maintenance history' })
  getAsset(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.bmsService.getAsset(propertyId, id);
  }

  @Patch('assets/:id')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Update asset details' })
  updateAsset(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateAssetDto>,
  ) {
    return this.bmsService.updateAsset(propertyId, id, dto);
  }

  @Patch('assets/:id/status')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Update asset operational status' })
  updateAssetStatus(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body('status') status: AssetStatus,
  ) {
    return this.bmsService.updateAssetStatus(propertyId, id, status);
  }

  // ─────────────────────────────────────────────────────────
  //  MAINTENANCE REQUESTS
  // ─────────────────────────────────────────────────────────

  @Post('maintenance-requests')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF')
  @ApiOperation({ summary: 'Create a new maintenance request' })
  createMaintenanceRequest(
    @PropertyId() propertyId: string,
    @Body() dto: CreateMaintenanceRequestDto,
    @CurrentUser() user: any,
  ) {
    return this.bmsService.createMaintenanceRequest(propertyId, dto, user.id);
  }

  @Get('maintenance-requests')
  @ApiOperation({ summary: 'List maintenance requests with optional filters' })
  @ApiQuery({ name: 'status', enum: MaintenanceRequestStatus, required: false })
  @ApiQuery({ name: 'priority', enum: MaintenancePriority, required: false })
  @ApiQuery({ name: 'assetId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listMaintenanceRequests(
    @PropertyId() propertyId: string,
    @Query('status') status?: MaintenanceRequestStatus,
    @Query('priority') priority?: MaintenancePriority,
    @Query('assetId') assetId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '30',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.bmsService.listMaintenanceRequests(propertyId, { status, priority, assetId, skip, take });
  }

  @Get('maintenance-requests/:id')
  @ApiOperation({ summary: 'Get a single maintenance request with work orders' })
  getMaintenanceRequest(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.bmsService.getMaintenanceRequest(propertyId, id);
  }

  @Patch('maintenance-requests/:id/assign')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Assign a maintenance request to a technician' })
  assignMaintenanceRequest(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body('assignedToId') assignedToId: string,
  ) {
    return this.bmsService.assignMaintenanceRequest(propertyId, id, assignedToId);
  }

  @Patch('maintenance-requests/:id/status')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF')
  @ApiOperation({ summary: 'Update the status of a maintenance request' })
  updateMaintenanceRequestStatus(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body('status') status: MaintenanceRequestStatus,
    @Body('resolution') resolution?: string,
  ) {
    return this.bmsService.updateMaintenanceRequestStatus(propertyId, id, status, resolution);
  }

  @Post('maintenance-requests/:id/close')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close a maintenance request — marks resolved and closes open work orders' })
  closeMaintenanceRequest(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body('resolution') resolution: string,
    @CurrentUser() user: any,
  ) {
    return this.bmsService.closeMaintenanceRequest(propertyId, id, resolution, user.id);
  }

  // ─────────────────────────────────────────────────────────
  //  WORK ORDERS
  // ─────────────────────────────────────────────────────────

  @Post('work-orders')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Create a new work order' })
  createWorkOrder(@PropertyId() propertyId: string, @Body() dto: CreateWorkOrderDto) {
    return this.bmsService.createWorkOrder(propertyId, dto);
  }

  @Get('work-orders')
  @ApiOperation({ summary: 'List work orders with optional filters' })
  @ApiQuery({ name: 'status', enum: WorkOrderStatus, required: false })
  @ApiQuery({ name: 'assignedToId', required: false, type: String })
  @ApiQuery({ name: 'assetId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listWorkOrders(
    @PropertyId() propertyId: string,
    @Query('status') status?: WorkOrderStatus,
    @Query('assignedToId') assignedToId?: string,
    @Query('assetId') assetId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '30',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.bmsService.listWorkOrders(propertyId, { status, assignedToId, assetId, skip, take });
  }

  @Patch('work-orders/:id/status')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF')
  @ApiOperation({ summary: 'Update work order status — include laborMinutes when completing' })
  updateWorkOrderStatus(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body('status') status: WorkOrderStatus,
    @Body('laborMinutes') laborMinutes?: number,
    @Body('notes') notes?: string,
  ) {
    return this.bmsService.updateWorkOrderStatus(propertyId, id, status, laborMinutes, notes);
  }

  // ─────────────────────────────────────────────────────────
  //  PREVENTIVE MAINTENANCE SCHEDULES
  // ─────────────────────────────────────────────────────────

  @Post('pm-schedules')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Create a preventive maintenance schedule for an asset' })
  createPMSchedule(
    @PropertyId() propertyId: string,
    @Body()
    dto: {
      assetId: string;
      name: string;
      description?: string;
      frequencyDays: number;
      nextDueDate: string;
      estimatedMinutes?: number;
      assignedDeptId?: string;
    },
  ) {
    return this.bmsService.createPMSchedule(propertyId, dto);
  }

  @Get('pm-schedules')
  @ApiOperation({ summary: 'List preventive maintenance schedules' })
  @ApiQuery({ name: 'dueOnly', required: false, type: Boolean, description: 'Return only overdue schedules' })
  listPMSchedules(
    @PropertyId() propertyId: string,
    @Query('dueOnly') dueOnly?: string,
  ) {
    return this.bmsService.listPMSchedules(propertyId, dueOnly === 'true');
  }

  @Post('pm-schedules/generate-work-orders')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate work orders for all overdue PM schedules' })
  generateWorkOrdersFromDueSchedules(
    @PropertyId() propertyId: string,
    @Body('assignedToId') assignedToId: string,
  ) {
    return this.bmsService.generateWorkOrdersFromDueSchedules(propertyId, assignedToId);
  }
}
