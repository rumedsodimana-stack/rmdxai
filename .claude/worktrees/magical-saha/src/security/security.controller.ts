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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { IncidentSeverity } from '@prisma/client';

import { SecurityService } from './security.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { AssignKeyCardDto } from './dto/assign-key-card.dto';
import { LogAccessDto } from './dto/log-access.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PropertyId } from '../../common/decorators/property-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('security')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('security')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  // ─────────────────────────────────────────────────────────
  //  ACCESS LOG — read-only + append (no update, no delete)
  // ─────────────────────────────────────────────────────────

  @Post('access-logs')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF')
  @ApiOperation({ summary: 'Append an access log entry (immutable once created)' })
  logAccess(@PropertyId() propertyId: string, @Body() dto: LogAccessDto) {
    return this.securityService.logAccess(propertyId, dto);
  }

  @Get('access-logs')
  @ApiOperation({ summary: 'List access log entries' })
  @ApiQuery({ name: 'location', required: false, type: String })
  @ApiQuery({ name: 'accessType', required: false, enum: ['entry', 'exit', 'denied'] })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'fromTime', required: false, type: String })
  @ApiQuery({ name: 'toTime', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listAccessLogs(
    @PropertyId() propertyId: string,
    @Query('location') location?: string,
    @Query('accessType') accessType?: string,
    @Query('userId') userId?: string,
    @Query('fromTime') fromTime?: string,
    @Query('toTime') toTime?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.securityService.listAccessLogs(propertyId, {
      location,
      accessType,
      userId,
      fromTime,
      toTime,
      skip,
      take,
    });
  }

  @Get('access-logs/:id')
  @ApiOperation({ summary: 'Get a single access log entry' })
  getAccessLog(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.securityService.getAccessLog(propertyId, id);
  }

  // ─────────────────────────────────────────────────────────
  //  INCIDENT REPORTS
  // ─────────────────────────────────────────────────────────

  @Post('incidents')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF')
  @ApiOperation({ summary: 'File a new incident report' })
  createIncident(
    @PropertyId() propertyId: string,
    @Body() dto: CreateIncidentDto,
    @CurrentUser() user: any,
  ) {
    return this.securityService.createIncident(propertyId, dto, user.id);
  }

  @Get('incidents')
  @ApiOperation({ summary: 'List incident reports' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['open', 'investigating', 'resolved', 'closed'],
  })
  @ApiQuery({ name: 'severity', enum: IncidentSeverity, required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listIncidents(
    @PropertyId() propertyId: string,
    @Query('status') status?: string,
    @Query('severity') severity?: IncidentSeverity,
    @Query('page') page = '1',
    @Query('limit') limit = '30',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.securityService.listIncidents(propertyId, { status, severity, skip, take });
  }

  @Get('incidents/:id')
  @ApiOperation({ summary: 'Get a single incident report' })
  getIncident(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.securityService.getIncident(propertyId, id);
  }

  @Patch('incidents/:id')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Update an incident report (cannot update closed incidents)' })
  updateIncident(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateIncidentDto> & { assignedToId?: string; status?: string },
  ) {
    return this.securityService.updateIncident(propertyId, id, dto);
  }

  @Post('incidents/:id/resolve')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark an incident as resolved with resolution notes' })
  resolveIncident(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body('resolution') resolution: string,
    @CurrentUser() user: any,
  ) {
    return this.securityService.resolveIncident(propertyId, id, resolution, user.id);
  }

  @Delete('incidents/:id')
  @Roles('GM', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an open unassigned incident (GM/ADMIN only)' })
  deleteIncident(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.securityService.deleteIncident(propertyId, id);
  }

  // ─────────────────────────────────────────────────────────
  //  KEY CARD ASSIGNMENTS
  // ─────────────────────────────────────────────────────────

  @Post('key-cards')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF')
  @ApiOperation({
    summary: 'Issue a key card — guest identity (guestProfileId) is REQUIRED',
  })
  assignKeyCard(
    @PropertyId() propertyId: string,
    @Body() dto: AssignKeyCardDto,
    @CurrentUser() user: any,
  ) {
    return this.securityService.assignKeyCard(propertyId, dto, user.id);
  }

  @Get('key-cards')
  @ApiOperation({ summary: 'List key card assignments' })
  @ApiQuery({ name: 'guestProfileId', required: false, type: String })
  @ApiQuery({ name: 'roomId', required: false, type: String })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listKeyCardAssignments(
    @PropertyId() propertyId: string,
    @Query('guestProfileId') guestProfileId?: string,
    @Query('roomId') roomId?: string,
    @Query('activeOnly') activeOnly?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '30',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.securityService.listKeyCardAssignments(propertyId, {
      guestProfileId,
      roomId,
      activeOnly: activeOnly === 'true',
      skip,
      take,
    });
  }

  @Post('key-cards/:id/return')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a key card as returned' })
  returnKeyCard(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.securityService.returnKeyCard(propertyId, id);
  }

  // ─────────────────────────────────────────────────────────
  //  SHIFT HANDOVER LOG
  // ─────────────────────────────────────────────────────────

  @Post('shift-handovers')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF')
  @ApiOperation({ summary: 'Create a shift handover log entry' })
  createShiftHandover(
    @PropertyId() propertyId: string,
    @CurrentUser() user: any,
    @Body()
    dto: {
      toUserId: string;
      shiftDate: string;
      summary: string;
      openIssues?: string;
      pendingTasks?: string;
      guestNotes?: string;
      cashBalance?: number;
    },
  ) {
    return this.securityService.createShiftHandover(propertyId, user.id, dto);
  }

  @Get('shift-handovers')
  @ApiOperation({ summary: 'List shift handover logs' })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listShiftHandovers(
    @PropertyId() propertyId: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '30',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.securityService.listShiftHandovers(propertyId, { fromDate, toDate, skip, take });
  }
}
