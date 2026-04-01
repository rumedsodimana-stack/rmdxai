import {
  Controller,
  Get,
  Post,
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
import { AutomationLevel, TaskStatus } from '@prisma/client';

import { OsKernelService } from './os-kernel.service';
import { PublishEventDto } from './dto/publish-event.dto';
import { CreateAutomationTaskDto } from './dto/create-automation-task.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PropertyId } from '../../common/decorators/property-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('os-kernel')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('os-kernel')
export class OsKernelController {
  constructor(private readonly osKernelService: OsKernelService) {}

  // ─────────────────────────────────────────────────────────
  //  EVENT BUS
  // ─────────────────────────────────────────────────────────

  @Post('events')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF')
  @ApiOperation({ summary: 'Publish an event to the OS event bus' })
  publishEvent(@PropertyId() propertyId: string, @Body() dto: PublishEventDto) {
    return this.osKernelService.publishEvent(propertyId, dto);
  }

  @Get('events')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'List events on the event bus' })
  @ApiQuery({ name: 'eventType', required: false, type: String })
  @ApiQuery({ name: 'entityType', required: false, type: String })
  @ApiQuery({ name: 'entityId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listEvents(
    @PropertyId() propertyId: string,
    @Query('eventType') eventType?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.osKernelService.listEvents(propertyId, { eventType, entityType, entityId, skip, take });
  }

  @Get('events/:id')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Get a single event log entry' })
  getEvent(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.osKernelService.getEvent(propertyId, id);
  }

  @Post('events/:id/acknowledge')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge processing of an event' })
  acknowledgeEvent(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.osKernelService.acknowledgeEvent(propertyId, id, user.id);
  }

  // ─────────────────────────────────────────────────────────
  //  AUTOMATION TASK QUEUE
  // ─────────────────────────────────────────────────────────

  @Post('tasks')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Enqueue an automation task (hard AI limits enforced)' })
  createTask(@PropertyId() propertyId: string, @Body() dto: CreateAutomationTaskDto) {
    return this.osKernelService.createAutomationTask(propertyId, dto);
  }

  @Get('tasks')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'List automation tasks' })
  @ApiQuery({ name: 'status', enum: TaskStatus, required: false })
  @ApiQuery({ name: 'automationLevel', enum: AutomationLevel, required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listTasks(
    @PropertyId() propertyId: string,
    @Query('status') status?: TaskStatus,
    @Query('automationLevel') automationLevel?: AutomationLevel,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.osKernelService.listTasks(propertyId, { status, automationLevel, skip, take });
  }

  @Get('tasks/:id')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Get the status of an automation task' })
  getTaskStatus(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.osKernelService.getTaskStatus(propertyId, id);
  }

  @Post('tasks/process-next')
  @Roles('GM', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pick up and start processing the next pending task' })
  processNextTask(@PropertyId() propertyId: string) {
    return this.osKernelService.processNextTask(propertyId);
  }

  @Post('tasks/:id/complete')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a running task as completed' })
  completeTask(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body('result') result: Record<string, any>,
  ) {
    return this.osKernelService.completeTask(propertyId, id, result ?? {});
  }

  @Post('tasks/:id/fail')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a running task as failed' })
  failTask(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body('errorMessage') errorMessage: string,
  ) {
    return this.osKernelService.failTask(propertyId, id, errorMessage);
  }

  @Post('tasks/:id/approve')
  @Roles('GM', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Human approval for tasks requiring L0/L1 authorisation' })
  approveTask(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.osKernelService.approveTask(propertyId, id, user.id);
  }

  // ─────────────────────────────────────────────────────────
  //  AI BOUNDARY LOG
  // ─────────────────────────────────────────────────────────

  @Get('ai-boundary-violations')
  @Roles('GM', 'ADMIN')
  @ApiOperation({ summary: 'List all attempted hard-limit AI boundary violations' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getAiBoundaryViolations(
    @PropertyId() propertyId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.osKernelService.getAiBoundaryViolations(propertyId, skip, take);
  }
}
