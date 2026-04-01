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

import { CrmService } from './crm.service';
import { CreateGuestProfileDto } from './dto/create-guest-profile.dto';
import { UpdateGuestProfileDto } from './dto/update-guest-profile.dto';
import { AddPreferenceDto } from './dto/add-preference.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PropertyId } from '../../common/decorators/property-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('crm')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  // ─────────────────────────────────────────────────────────
  //  GUEST PROFILES
  // ─────────────────────────────────────────────────────────

  @Post('guests')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF')
  @ApiOperation({ summary: 'Create a new guest profile' })
  createGuestProfile(@PropertyId() propertyId: string, @Body() dto: CreateGuestProfileDto) {
    return this.crmService.createGuestProfile(propertyId, dto);
  }

  @Get('guests')
  @ApiOperation({ summary: 'List all guest profiles (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listGuestProfiles(
    @PropertyId() propertyId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.crmService.listGuestProfiles(propertyId, { skip, take });
  }

  @Get('guests/search')
  @ApiOperation({ summary: 'Search guests by name, email, phone, or passport' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  searchGuests(
    @PropertyId() propertyId: string,
    @Query('q') query: string,
    @Query('limit') limit = '20',
  ) {
    return this.crmService.searchGuests(propertyId, query, parseInt(limit, 10));
  }

  @Get('guests/:id')
  @ApiOperation({ summary: 'Get a guest profile with preferences, notes, and recent stays' })
  getGuestProfile(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.crmService.getGuestProfile(propertyId, id);
  }

  @Patch('guests/:id')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF')
  @ApiOperation({ summary: 'Update a guest profile' })
  updateGuestProfile(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGuestProfileDto,
  ) {
    return this.crmService.updateGuestProfile(propertyId, id, dto);
  }

  @Delete('guests/:id')
  @Roles('GM', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a guest profile (no active reservations)' })
  deleteGuestProfile(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.crmService.deleteGuestProfile(propertyId, id);
  }

  // ─────────────────────────────────────────────────────────
  //  MERGE
  // ─────────────────────────────────────────────────────────

  @Get('guests/:id/merge-candidates')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Find potential duplicate profiles for merging' })
  findMergeCandidates(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.crmService.findMergeCandidates(propertyId, id);
  }

  @Post('guests/:survivorId/merge/:duplicateId')
  @Roles('GM', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Merge duplicate into survivor — reservations, points, notes all re-pointed' })
  mergeGuestProfiles(
    @PropertyId() propertyId: string,
    @Param('survivorId') survivorId: string,
    @Param('duplicateId') duplicateId: string,
    @CurrentUser() user: any,
  ) {
    return this.crmService.mergeGuestProfiles(propertyId, survivorId, duplicateId, user.id);
  }

  // ─────────────────────────────────────────────────────────
  //  STAY HISTORY
  // ─────────────────────────────────────────────────────────

  @Get('guests/:id/stays')
  @ApiOperation({ summary: 'Get stay history for a guest' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getStayHistory(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.crmService.getStayHistory(propertyId, id, skip, take);
  }

  @Post('guests/:id/stays/record')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'FINANCE')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record a completed stay and award loyalty points' })
  recordStayAndUpdateLoyalty(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body('reservationId') reservationId: string,
    @Body('pointsEarned') pointsEarned: number,
    @CurrentUser() user: any,
  ) {
    return this.crmService.recordStayAndUpdateLoyalty(propertyId, id, reservationId, pointsEarned, user.id);
  }

  // ─────────────────────────────────────────────────────────
  //  PREFERENCES
  // ─────────────────────────────────────────────────────────

  @Post('guests/:id/preferences')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF')
  @ApiOperation({ summary: 'Add a guest preference' })
  addPreference(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: AddPreferenceDto,
  ) {
    return this.crmService.addPreference(propertyId, id, dto);
  }

  @Get('guests/:id/preferences')
  @ApiOperation({ summary: 'Get all preferences for a guest' })
  getPreferences(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.crmService.getPreferences(propertyId, id);
  }

  @Delete('guests/:id/preferences/:preferenceId')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a guest preference' })
  deletePreference(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Param('preferenceId') preferenceId: string,
  ) {
    return this.crmService.deletePreference(propertyId, id, preferenceId);
  }

  // ─────────────────────────────────────────────────────────
  //  VIP
  // ─────────────────────────────────────────────────────────

  @Patch('guests/:id/vip')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Set or unset VIP flag for a guest' })
  setVipFlag(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body('isVip') isVip: boolean,
    @Body('reason') reason: string,
    @CurrentUser() user: any,
  ) {
    return this.crmService.setVipFlag(propertyId, id, isVip, reason, user.id);
  }

  // ─────────────────────────────────────────────────────────
  //  NOTES
  // ─────────────────────────────────────────────────────────

  @Post('guests/:id/notes')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR', 'STAFF')
  @ApiOperation({ summary: 'Add a note to a guest profile' })
  addNote(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body('content') content: string,
    @Body('type') type: string,
    @Body('isPrivate') isPrivate: boolean,
    @CurrentUser() user: any,
  ) {
    return this.crmService.addNote(propertyId, id, content, type, isPrivate, user.id);
  }

  @Get('guests/:id/notes')
  @ApiOperation({ summary: 'Get notes for a guest profile' })
  @ApiQuery({ name: 'includePrivate', required: false, type: Boolean })
  getNotes(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Query('includePrivate') includePrivate?: string,
  ) {
    return this.crmService.getNotes(propertyId, id, includePrivate === 'true');
  }

  // ─────────────────────────────────────────────────────────
  //  LOYALTY
  // ─────────────────────────────────────────────────────────

  @Get('guests/:id/loyalty')
  @ApiOperation({ summary: 'Get loyalty transaction history for a guest' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getLoyaltyTransactions(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.crmService.getLoyaltyTransactions(propertyId, id, skip, take);
  }
}
