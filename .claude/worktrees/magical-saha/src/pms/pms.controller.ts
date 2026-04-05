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
import { RoomStatus, ReservationStatus } from '@prisma/client';

import { PmsService } from './pms.service';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { CreateFolioItemDto } from './dto/create-folio-item.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PropertyId } from '../../common/decorators/property-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('pms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pms')
export class PmsController {
  constructor(private readonly pmsService: PmsService) {}

  // ─────────────────────────────────────────────────────────
  //  ROOM TYPES
  // ─────────────────────────────────────────────────────────

  @Post('room-types')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Create a new room type' })
  createRoomType(@PropertyId() propertyId: string, @Body() dto: CreateRoomTypeDto) {
    return this.pmsService.createRoomType(propertyId, dto);
  }

  @Get('room-types')
  @ApiOperation({ summary: 'List all active room types' })
  listRoomTypes(@PropertyId() propertyId: string) {
    return this.pmsService.listRoomTypes(propertyId);
  }

  @Patch('room-types/:id')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Update a room type' })
  updateRoomType(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateRoomTypeDto>,
  ) {
    return this.pmsService.updateRoomType(propertyId, id, dto);
  }

  // ─────────────────────────────────────────────────────────
  //  ROOMS
  // ─────────────────────────────────────────────────────────

  @Post('rooms')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Create a new room' })
  createRoom(@PropertyId() propertyId: string, @Body() dto: CreateRoomDto) {
    return this.pmsService.createRoom(propertyId, dto);
  }

  @Get('rooms')
  @ApiOperation({ summary: 'List rooms, optionally filtered by status' })
  @ApiQuery({ name: 'status', enum: RoomStatus, required: false })
  listRooms(
    @PropertyId() propertyId: string,
    @Query('status') status?: RoomStatus,
  ) {
    return this.pmsService.listRooms(propertyId, status);
  }

  @Get('rooms/:id')
  @ApiOperation({ summary: 'Get a single room with current reservations' })
  getRoom(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.pmsService.getRoom(propertyId, id);
  }

  @Patch('rooms/:id/status')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Update room housekeeping / OOO status' })
  updateRoomStatus(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRoomStatusDto,
  ) {
    return this.pmsService.updateRoomStatus(propertyId, id, dto);
  }

  @Patch('rooms/:id/inspected')
  @Roles('GM', 'ADMIN', 'SUPERVISOR')
  @ApiOperation({ summary: 'Mark room as CLEAN after housekeeper inspection' })
  markHousekeeperInspected(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.pmsService.markHousekeeperInspected(propertyId, id, user.id);
  }

  // ─────────────────────────────────────────────────────────
  //  RESERVATIONS
  // ─────────────────────────────────────────────────────────

  @Post('reservations')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF')
  @ApiOperation({ summary: 'Create a new reservation' })
  createReservation(@PropertyId() propertyId: string, @Body() dto: CreateReservationDto) {
    return this.pmsService.createReservation(propertyId, dto);
  }

  @Get('reservations')
  @ApiOperation({ summary: 'List reservations with optional filters' })
  @ApiQuery({ name: 'status', enum: ReservationStatus, required: false })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listReservations(
    @PropertyId() propertyId: string,
    @Query('status') status?: ReservationStatus,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.pmsService.listReservations(propertyId, { status, fromDate, toDate, skip, take });
  }

  @Get('reservations/:id')
  @ApiOperation({ summary: 'Get a single reservation with folio' })
  getReservation(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.pmsService.getReservation(propertyId, id);
  }

  @Patch('reservations/:id')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF')
  @ApiOperation({ summary: 'Update a reservation' })
  updateReservation(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateReservationDto>,
  ) {
    return this.pmsService.updateReservation(propertyId, id, dto);
  }

  @Post('reservations/:id/cancel')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a reservation' })
  cancelReservation(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
  ) {
    return this.pmsService.cancelReservation(propertyId, id, reason, user.id);
  }

  @Post('reservations/:id/check-in')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check in a guest — assigns room and creates folio' })
  checkIn(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: CheckInDto,
    @CurrentUser() user: any,
  ) {
    return this.pmsService.checkIn(propertyId, id, dto, user.id);
  }

  @Post('reservations/:id/check-out')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check out a guest — closes folio and marks room dirty' })
  checkOut(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: CheckOutDto,
    @CurrentUser() user: any,
  ) {
    return this.pmsService.checkOut(propertyId, id, dto, user.id);
  }

  @Post('reservations/:id/no-show')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a reservation as no-show' })
  noShow(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.pmsService.noShow(propertyId, id);
  }

  @Get('reservations/:id/folio')
  @ApiOperation({ summary: 'Get the folio for a reservation' })
  getFolio(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.pmsService.getFolio(propertyId, id);
  }

  // ─────────────────────────────────────────────────────────
  //  FOLIOS
  // ─────────────────────────────────────────────────────────

  @Post('folios/:folioId/items')
  @Roles('GM', 'ADMIN', 'FINANCE', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF')
  @ApiOperation({ summary: 'Post a charge or credit to a folio' })
  addFolioItem(
    @PropertyId() propertyId: string,
    @Param('folioId') folioId: string,
    @Body() dto: CreateFolioItemDto,
    @CurrentUser() user: any,
  ) {
    return this.pmsService.addFolioItem(propertyId, folioId, dto, user.id);
  }

  @Post('folios/items/:itemId/void')
  @Roles('GM', 'ADMIN', 'FINANCE', 'DEPT_MANAGER', 'SUPERVISOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Void a folio line item' })
  voidFolioItem(
    @PropertyId() propertyId: string,
    @Param('itemId') itemId: string,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
  ) {
    return this.pmsService.voidFolioItem(propertyId, itemId, reason, user.id);
  }

  @Post('folios/:folioId/payment')
  @Roles('GM', 'ADMIN', 'FINANCE', 'DEPT_MANAGER', 'SUPERVISOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Post a payment against a folio' })
  postPayment(
    @PropertyId() propertyId: string,
    @Param('folioId') folioId: string,
    @Body('amount') amount: number,
    @Body('method') method: string,
    @CurrentUser() user: any,
  ) {
    return this.pmsService.postPayment(propertyId, folioId, amount, method, user.id);
  }

  @Post('folios/:folioId/close')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close a folio (balance must be zero)' })
  closeFolio(
    @PropertyId() propertyId: string,
    @Param('folioId') folioId: string,
    @CurrentUser() user: any,
  ) {
    return this.pmsService.closeFolio(propertyId, folioId, user.id);
  }

  // ─────────────────────────────────────────────────────────
  //  NIGHT AUDIT
  // ─────────────────────────────────────────────────────────

  @Post('night-audit/run')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run the nightly audit — posts room charges and calculates KPIs' })
  runNightAudit(@PropertyId() propertyId: string, @CurrentUser() user: any) {
    return this.pmsService.runNightAudit(propertyId, user.id);
  }

  @Get('night-audit')
  @ApiOperation({ summary: 'Retrieve the night audit for a specific date' })
  @ApiQuery({ name: 'date', required: true, type: String, example: '2025-09-01' })
  getNightAudit(@PropertyId() propertyId: string, @Query('date') date: string) {
    return this.pmsService.getNightAudit(propertyId, date);
  }

  @Get('night-audit/history')
  @ApiOperation({ summary: 'List night audit history (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listNightAudits(
    @PropertyId() propertyId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '30',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.pmsService.listNightAudits(propertyId, skip, take);
  }
}
