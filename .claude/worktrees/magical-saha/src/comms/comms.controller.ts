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
import { NotificationChannel } from '@prisma/client';

import { CommsService } from './comms.service';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PropertyId } from '../../common/decorators/property-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('comms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('comms')
export class CommsController {
  constructor(private readonly commsService: CommsService) {}

  // ─────────────────────────────────────────────────────────
  //  MESSAGES
  // ─────────────────────────────────────────────────────────

  @Post('messages')
  @ApiOperation({ summary: 'Send a staff-to-staff message' })
  sendMessage(
    @PropertyId() propertyId: string,
    @CurrentUser() user: any,
    @Body() dto: SendMessageDto,
  ) {
    return this.commsService.sendMessage(propertyId, user.id, dto);
  }

  @Get('messages')
  @ApiOperation({ summary: 'List messages for the current user (top-level threads)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getMyMessages(
    @PropertyId() propertyId: string,
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.commsService.getMessagesForUser(propertyId, user.id, skip, take);
  }

  @Get('messages/:id/thread')
  @ApiOperation({ summary: 'Get a message thread (root + replies)' })
  getThread(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.commsService.getThread(propertyId, id);
  }

  @Post('messages/:id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a message as read' })
  markRead(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.commsService.markMessageRead(propertyId, id, user.id);
  }

  // ─────────────────────────────────────────────────────────
  //  ANNOUNCEMENTS
  // ─────────────────────────────────────────────────────────

  @Post('announcements')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Create a broadcast announcement' })
  createAnnouncement(
    @PropertyId() propertyId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.commsService.createAnnouncement(propertyId, user.id, dto);
  }

  @Get('announcements')
  @ApiOperation({ summary: 'List active announcements, optionally filtered by department' })
  @ApiQuery({ name: 'department', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listAnnouncements(
    @PropertyId() propertyId: string,
    @Query('department') department?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.commsService.listAnnouncements(propertyId, { department, skip, take });
  }

  @Get('announcements/:id')
  @ApiOperation({ summary: 'Get a single announcement' })
  getAnnouncement(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.commsService.getAnnouncement(propertyId, id);
  }

  @Patch('announcements/:id')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Update an announcement' })
  updateAnnouncement(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateAnnouncementDto>,
  ) {
    return this.commsService.updateAnnouncement(propertyId, id, dto);
  }

  // ─────────────────────────────────────────────────────────
  //  NOTIFICATION LOGS
  // ─────────────────────────────────────────────────────────

  @Post('notifications/log')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Log a notification delivery attempt' })
  logNotification(
    @PropertyId() propertyId: string,
    @Body('recipientId') recipientId: string,
    @Body('channel') channel: NotificationChannel,
    @Body('subject') subject: string,
    @Body('body') body: string,
    @Body('referenceType') referenceType?: string,
    @Body('referenceId') referenceId?: string,
  ) {
    return this.commsService.logNotification(
      propertyId,
      recipientId,
      channel,
      subject,
      body,
      referenceType,
      referenceId,
    );
  }

  @Post('notifications/:id/delivered')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification log entry as delivered' })
  markDelivered(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.commsService.markNotificationDelivered(propertyId, id);
  }

  @Get('notifications')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'List notification delivery logs' })
  @ApiQuery({ name: 'recipientId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getNotificationLogs(
    @PropertyId() propertyId: string,
    @Query('recipientId') recipientId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.commsService.getNotificationLogs(propertyId, recipientId, skip, take);
  }
}
