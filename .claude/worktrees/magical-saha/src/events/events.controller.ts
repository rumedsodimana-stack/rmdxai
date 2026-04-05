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
import { EventBookingStatus, SetupStyle } from '@prisma/client';

import { EventsService } from './events.service';
import { CreateEventBookingDto } from './dto/create-event-booking.dto';
import { CreateFunctionSheetDto } from './dto/create-function-sheet.dto';
import { CreateBanquetOrderDto } from './dto/create-banquet-order.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PropertyId } from '../../common/decorators/property-id.decorator';

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // ─────────────────────────────────────────────────────────
  //  EVENT BOOKINGS
  // ─────────────────────────────────────────────────────────

  @Post('bookings')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF')
  @ApiOperation({ summary: 'Create a new event booking' })
  createEventBooking(
    @PropertyId() propertyId: string,
    @Body() dto: CreateEventBookingDto,
  ) {
    return this.eventsService.createEventBooking(propertyId, dto);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'List event bookings with optional filters' })
  @ApiQuery({ name: 'status', enum: EventBookingStatus, required: false })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listEventBookings(
    @PropertyId() propertyId: string,
    @Query('status') status?: EventBookingStatus,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.eventsService.listEventBookings(propertyId, { status, fromDate, toDate, skip, take });
  }

  @Get('bookings/:id')
  @ApiOperation({ summary: 'Get a single event booking with function sheets and banquet orders' })
  getEventBooking(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.eventsService.getEventBooking(propertyId, id);
  }

  @Patch('bookings/:id')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Update an event booking' })
  updateEventBooking(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateEventBookingDto>,
  ) {
    return this.eventsService.updateEventBooking(propertyId, id, dto);
  }

  @Patch('bookings/:id/status')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Update event booking status' })
  updateEventBookingStatus(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body('status') status: EventBookingStatus,
  ) {
    return this.eventsService.updateEventBookingStatus(propertyId, id, status);
  }

  @Post('bookings/:id/cancel')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an event booking' })
  cancelEventBooking(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.eventsService.cancelEventBooking(propertyId, id);
  }

  // ─────────────────────────────────────────────────────────
  //  FUNCTION SHEETS
  // ─────────────────────────────────────────────────────────

  @Post('function-sheets')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Create a function sheet for an event booking' })
  createFunctionSheet(
    @PropertyId() propertyId: string,
    @Body() dto: CreateFunctionSheetDto,
  ) {
    return this.eventsService.createFunctionSheet(propertyId, dto);
  }

  @Patch('function-sheets/:id')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Update a function sheet (only before confirmation)' })
  updateFunctionSheet(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateFunctionSheetDto>,
  ) {
    return this.eventsService.updateFunctionSheet(propertyId, id, dto);
  }

  @Post('function-sheets/:id/finalize')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finalize / confirm a function sheet' })
  finalizeFunctionSheet(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.eventsService.finalizeFunctionSheet(propertyId, id);
  }

  @Post('function-sheets/:id/equipment')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Add an AV / equipment item to a function sheet' })
  addEquipment(
    @PropertyId() propertyId: string,
    @Param('id') sheetId: string,
    @Body() body: {
      itemName: string;
      category: string;
      quantity: number;
      unitCost?: number;
      supplier?: string;
      notes?: string;
    },
  ) {
    return this.eventsService.addEquipmentToSheet(propertyId, sheetId, body);
  }

  @Post('function-sheets/:id/room-setups')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Add a room setup configuration (theater/classroom/banquet/cocktail…)' })
  addRoomSetup(
    @PropertyId() propertyId: string,
    @Param('id') sheetId: string,
    @Body() body: { roomName: string; setupStyle: SetupStyle; capacity: number; notes?: string },
  ) {
    return this.eventsService.addRoomSetup(propertyId, sheetId, body);
  }

  // ─────────────────────────────────────────────────────────
  //  BANQUET ORDERS
  // ─────────────────────────────────────────────────────────

  @Post('banquet-orders')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Create a banquet order for an event' })
  createBanquetOrder(
    @PropertyId() propertyId: string,
    @Body() dto: CreateBanquetOrderDto,
  ) {
    return this.eventsService.createBanquetOrder(propertyId, dto);
  }

  @Get('banquet-orders/:id')
  @ApiOperation({ summary: 'Get a banquet order' })
  getBanquetOrder(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.eventsService.getBanquetOrder(propertyId, id);
  }

  @Post('banquet-orders/:id/confirm')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a banquet order' })
  confirmBanquetOrder(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.eventsService.confirmBanquetOrder(propertyId, id);
  }
}
