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

import { GuestAppService } from './guest-app.service';
import { GuestCheckinRequestDto } from './dto/guest-checkin-request.dto';
import { ServiceRequestDto } from './dto/service-request.dto';
import { GuestFeedbackDto } from './dto/guest-feedback.dto';
import { GuestMessageDto } from './dto/guest-message.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PropertyId } from '../../common/decorators/property-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('guest-app')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('guest-app')
export class GuestAppController {
  constructor(private readonly guestAppService: GuestAppService) {}

  // ─────────────────────────────────────────────────────────
  //  CHECK-IN / CHECK-OUT
  // ─────────────────────────────────────────────────────────

  @Post('check-in')
  @Roles('GUEST', 'STAFF', 'SUPERVISOR', 'GM', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Guest self check-in by booking ref + last name' })
  selfCheckIn(@PropertyId() propertyId: string, @Body() dto: GuestCheckinRequestDto) {
    return this.guestAppService.selfCheckIn(propertyId, dto);
  }

  @Post('check-out')
  @Roles('GUEST', 'STAFF', 'SUPERVISOR', 'GM', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Guest check-out request — notifies front desk' })
  requestCheckOut(@PropertyId() propertyId: string, @CurrentUser() user: any) {
    return this.guestAppService.requestCheckOut(propertyId, user.id);
  }

  // ─────────────────────────────────────────────────────────
  //  SERVICE REQUESTS
  // ─────────────────────────────────────────────────────────

  @Post('service-requests')
  @Roles('GUEST', 'STAFF', 'SUPERVISOR', 'GM', 'ADMIN')
  @ApiOperation({ summary: 'Create a service request (housekeeping / maintenance / F&B)' })
  createServiceRequest(
    @PropertyId() propertyId: string,
    @CurrentUser() user: any,
    @Body() dto: ServiceRequestDto,
  ) {
    return this.guestAppService.createServiceRequest(propertyId, user.id, dto);
  }

  @Get('service-requests')
  @Roles('GUEST', 'STAFF', 'SUPERVISOR', 'GM', 'ADMIN')
  @ApiOperation({ summary: "List the current guest's service requests" })
  listServiceRequests(@PropertyId() propertyId: string, @CurrentUser() user: any) {
    return this.guestAppService.listServiceRequests(propertyId, user.id);
  }

  @Get('service-requests/:id')
  @Roles('GUEST', 'STAFF', 'SUPERVISOR', 'GM', 'ADMIN')
  @ApiOperation({ summary: 'Get a single service request' })
  getServiceRequest(
    @PropertyId() propertyId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.guestAppService.getServiceRequest(propertyId, id, user.id);
  }

  // ─────────────────────────────────────────────────────────
  //  CHAT MESSAGES
  // ─────────────────────────────────────────────────────────

  @Post('messages')
  @Roles('GUEST', 'STAFF', 'SUPERVISOR', 'GM', 'ADMIN')
  @ApiOperation({ summary: 'Send a message from guest to front desk' })
  sendMessage(
    @PropertyId() propertyId: string,
    @CurrentUser() user: any,
    @Body() dto: GuestMessageDto,
  ) {
    return this.guestAppService.sendMessage(propertyId, user.id, dto);
  }

  @Get('messages')
  @Roles('GUEST', 'STAFF', 'SUPERVISOR', 'GM', 'ADMIN')
  @ApiOperation({ summary: 'Get chat history for this guest' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getChatHistory(
    @PropertyId() propertyId: string,
    @CurrentUser() user: any,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.guestAppService.getChatHistory(propertyId, user.id, skip, take);
  }

  @Post('messages/reply/:guestProfileId')
  @Roles('STAFF', 'SUPERVISOR', 'GM', 'ADMIN')
  @ApiOperation({ summary: 'Staff reply to a guest message thread' })
  replyToGuest(
    @PropertyId() propertyId: string,
    @Param('guestProfileId') guestProfileId: string,
    @Body('content') content: string,
    @CurrentUser() user: any,
  ) {
    return this.guestAppService.replyToGuest(propertyId, guestProfileId, content, user.id);
  }

  @Post('messages/read')
  @Roles('STAFF', 'SUPERVISOR', 'GM', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all unread guest messages as read' })
  markMessagesRead(
    @PropertyId() propertyId: string,
    @Body('guestProfileId') guestProfileId: string,
  ) {
    return this.guestAppService.markMessagesRead(propertyId, guestProfileId);
  }

  // ─────────────────────────────────────────────────────────
  //  FEEDBACK
  // ─────────────────────────────────────────────────────────

  @Post('feedback')
  @Roles('GUEST', 'STAFF', 'SUPERVISOR', 'GM', 'ADMIN')
  @ApiOperation({ summary: 'Submit guest feedback / rating' })
  submitFeedback(
    @PropertyId() propertyId: string,
    @CurrentUser() user: any,
    @Body() dto: GuestFeedbackDto,
  ) {
    return this.guestAppService.submitFeedback(propertyId, user.id, dto);
  }

  @Get('feedback/mine')
  @Roles('GUEST', 'STAFF', 'SUPERVISOR', 'GM', 'ADMIN')
  @ApiOperation({ summary: "Get the current guest's feedback history" })
  getMyFeedback(@PropertyId() propertyId: string, @CurrentUser() user: any) {
    return this.guestAppService.getFeedback(propertyId, user.id);
  }

  @Get('feedback')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'List all guest feedback for the property (staff view)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listPropertyFeedback(
    @PropertyId() propertyId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.guestAppService.listPropertyFeedback(propertyId, { skip, take });
  }
}
