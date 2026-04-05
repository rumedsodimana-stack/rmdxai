import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PropertyId } from '../../common/decorators/property-id.decorator';
import { ChannelService } from './channel.service';
import { CreateRatePlanDto } from './dto/create-rate-plan.dto';
import { CreateChannelConnectionDto } from './dto/create-channel-connection.dto';
import { SyncAvailabilityDto } from './dto/sync-availability.dto';
import { MapChannelRateDto } from './dto/map-channel-rate.dto';
import { SyncStatus } from '@prisma/client';

@ApiTags('Channel Manager')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('channel')
export class ChannelController {
  constructor(private readonly channelService: ChannelService) {}

  // ─── Rate Plans ───────────────────────────────────────────────────

  @Post('rate-plans')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Create a new rate plan' })
  createRatePlan(@PropertyId() propertyId: string, @Body() dto: CreateRatePlanDto) {
    return this.channelService.createRatePlan(propertyId, dto);
  }

  @Get('rate-plans')
  @ApiOperation({ summary: 'List all active rate plans, optionally filtered by room type' })
  @ApiQuery({ name: 'roomTypeId', required: false })
  listRatePlans(
    @PropertyId() propertyId: string,
    @Query('roomTypeId') roomTypeId?: string,
  ) {
    return this.channelService.listRatePlans(propertyId, roomTypeId);
  }

  @Patch('rate-plans/:id')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Update a rate plan' })
  updateRatePlan(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateRatePlanDto>,
  ) {
    return this.channelService.updateRatePlan(propertyId, id, dto);
  }

  @Delete('rate-plans/:id')
  @Roles('GM', 'ADMIN')
  @ApiOperation({ summary: 'Soft-delete (deactivate) a rate plan' })
  deleteRatePlan(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.channelService.deleteRatePlan(propertyId, id);
  }

  // ─── Channel Connections ──────────────────────────────────────────

  @Post('connections')
  @Roles('GM', 'ADMIN')
  @ApiOperation({ summary: 'Create a new OTA channel connection' })
  createChannelConnection(
    @PropertyId() propertyId: string,
    @Body() dto: CreateChannelConnectionDto,
  ) {
    return this.channelService.createChannelConnection(propertyId, dto);
  }

  @Get('connections')
  @ApiOperation({ summary: 'List all channel connections for this property' })
  listChannelConnections(@PropertyId() propertyId: string) {
    return this.channelService.listChannelConnections(propertyId);
  }

  @Patch('connections/:id')
  @Roles('GM', 'ADMIN')
  @ApiOperation({ summary: 'Update a channel connection' })
  updateChannelConnection(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateChannelConnectionDto>,
  ) {
    return this.channelService.updateChannelConnection(propertyId, id, dto);
  }

  @Post('connections/rate-mapping')
  @Roles('GM', 'ADMIN')
  @ApiOperation({ summary: 'Map an internal rate plan to a channel rate code' })
  mapChannelRate(@PropertyId() propertyId: string, @Body() dto: MapChannelRateDto) {
    return this.channelService.mapChannelRate(propertyId, dto);
  }

  @Post('connections/:connectionId/sync-availability')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Sync availability blocks to OTA channel' })
  syncAvailability(
    @PropertyId() propertyId: string,
    @Param('connectionId') connectionId: string,
    @Body() dto: SyncAvailabilityDto,
  ) {
    return this.channelService.syncAvailability(propertyId, connectionId, dto);
  }

  @Post('connections/:connectionId/push-rates')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Push rate plan rates to an OTA channel for a date range' })
  @ApiQuery({ name: 'ratePlanId', required: true })
  @ApiQuery({ name: 'fromDate', required: true })
  @ApiQuery({ name: 'toDate', required: true })
  pushRatesToChannel(
    @PropertyId() propertyId: string,
    @Param('connectionId') connectionId: string,
    @Query('ratePlanId') ratePlanId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    return this.channelService.pushRatesToChannel(
      propertyId,
      connectionId,
      ratePlanId,
      fromDate,
      toDate,
    );
  }

  // ─── Sync Queue ───────────────────────────────────────────────────

  @Get('sync-queue')
  @ApiOperation({ summary: 'Get channel sync queue entries' })
  @ApiQuery({ name: 'status', required: false, enum: SyncStatus })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getChannelSyncQueue(
    @PropertyId() propertyId: string,
    @Query('status') status?: SyncStatus,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    const skip = (page - 1) * limit;
    return this.channelService.getChannelSyncQueue(propertyId, status, skip, limit);
  }

  @Post('sync-queue/retry')
  @Roles('GM', 'ADMIN')
  @ApiOperation({ summary: 'Retry all failed channel sync entries' })
  retryFailedSyncs(@PropertyId() propertyId: string) {
    return this.channelService.retryFailedSyncs(propertyId);
  }

  // ─── Availability Calendar ────────────────────────────────────────

  @Get('availability-calendar')
  @ApiOperation({ summary: 'Get availability calendar for a room type over a date range' })
  @ApiQuery({ name: 'roomTypeId', required: true })
  @ApiQuery({ name: 'fromDate', required: true })
  @ApiQuery({ name: 'toDate', required: true })
  getAvailabilityCalendar(
    @PropertyId() propertyId: string,
    @Query('roomTypeId') roomTypeId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    return this.channelService.getAvailabilityCalendar(propertyId, roomTypeId, fromDate, toDate);
  }
}
