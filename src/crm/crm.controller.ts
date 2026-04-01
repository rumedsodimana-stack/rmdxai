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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CrmService } from './crm.service';
import { CreateGuestProfileDto } from './dto/create-guest-profile.dto';
import { UpdateGuestProfileDto } from './dto/update-guest-profile.dto';
import { CreateGuestNoteDto } from './dto/create-guest-note.dto';
import { CreateGuestPreferenceDto } from './dto/create-guest-preference.dto';
import { AdjustLoyaltyPointsDto } from './dto/adjust-loyalty-points.dto';
import { BlacklistGuestDto } from './dto/blacklist-guest.dto';
import { LoyaltyTier } from '@prisma/client';

@ApiTags('CRM — Guest Profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  // ─── Guest Profiles ───────────────────────────────────────────────

  @Post('guests')
  @ApiOperation({ summary: 'Create a new guest profile' })
  createGuestProfile(
    @PropertyId() propertyId: string,
    @Body() dto: CreateGuestProfileDto,
  ) {
    return this.crmService.createGuestProfile(propertyId, dto);
  }

  @Get('guests')
  @ApiOperation({ summary: 'Search guest profiles' })
  @ApiQuery({ name: 'name', required: false })
  @ApiQuery({ name: 'email', required: false })
  @ApiQuery({ name: 'phone', required: false })
  @ApiQuery({ name: 'loyaltyTier', required: false, enum: LoyaltyTier })
  @ApiQuery({ name: 'isVip', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  searchGuests(
    @PropertyId() propertyId: string,
    @Query('name') name?: string,
    @Query('email') email?: string,
    @Query('phone') phone?: string,
    @Query('loyaltyTier') loyaltyTier?: LoyaltyTier,
    @Query('isVip') isVip?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    const skip = (page - 1) * limit;
    const isVipBool = isVip === undefined ? undefined : isVip === 'true';
    return this.crmService.searchGuestProfiles(propertyId, {
      name,
      email,
      phone,
      loyaltyTier,
      isVip: isVipBool,
      skip,
      take: limit,
    });
  }

  @Get('guests/:id')
  @ApiOperation({ summary: 'Get a guest profile with preferences, recent notes, and stay history' })
  getGuest(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.crmService.getGuestProfile(propertyId, id);
  }

  @Patch('guests/:id')
  @ApiOperation({ summary: 'Update a guest profile' })
  updateGuest(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGuestProfileDto,
  ) {
    return this.crmService.updateGuestProfile(propertyId, id, dto);
  }

  // ─── Notes ────────────────────────────────────────────────────────

  @Post('guests/:id/notes')
  @ApiOperation({ summary: 'Add a note to a guest profile' })
  addNote(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: CreateGuestNoteDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.crmService.addGuestNote(propertyId, id, dto, userId);
  }

  @Get('guests/:id/notes')
  @ApiOperation({ summary: 'List all notes for a guest profile' })
  listNotes(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.crmService.listGuestNotes(propertyId, id);
  }

  @Delete('guests/notes/:noteId')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Delete a guest note (author or GM/Admin only)' })
  deleteNote(
    @PropertyId() propertyId: string,
    @Param('noteId') noteId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.crmService.deleteGuestNote(propertyId, noteId, userId);
  }

  // ─── Preferences ──────────────────────────────────────────────────

  @Post('guests/:id/preferences')
  @ApiOperation({ summary: 'Add a preference to a guest profile' })
  addPreference(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: CreateGuestPreferenceDto,
  ) {
    return this.crmService.addPreference(propertyId, id, dto);
  }

  @Get('guests/:id/preferences')
  @ApiOperation({ summary: 'List preferences for a guest profile' })
  listPreferences(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.crmService.listPreferences(propertyId, id);
  }

  @Delete('guests/preferences/:prefId')
  @ApiOperation({ summary: 'Delete a guest preference' })
  deletePreference(@PropertyId() propertyId: string, @Param('prefId') prefId: string) {
    return this.crmService.deletePreference(propertyId, prefId);
  }

  // ─── Loyalty ──────────────────────────────────────────────────────

  @Post('guests/:id/loyalty/adjust')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Adjust loyalty points for a guest (earn, redeem, adjust, expire)' })
  adjustLoyalty(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: AdjustLoyaltyPointsDto,
  ) {
    return this.crmService.adjustLoyaltyPoints(propertyId, id, dto);
  }

  @Get('guests/:id/loyalty/history')
  @ApiOperation({ summary: 'Get loyalty transaction history for a guest' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getLoyaltyHistory(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.crmService.getLoyaltyHistory(propertyId, id, (page - 1) * limit, limit);
  }

  // ─── VIP & Blacklist ──────────────────────────────────────────────

  @Patch('guests/:id/vip')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Set or remove VIP status for a guest' })
  setVipStatus(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() body: { isVip: boolean; reason: string },
    @CurrentUser('sub') userId: string,
  ) {
    return this.crmService.setVipStatus(propertyId, id, body.isVip, body.reason, userId);
  }

  @Post('guests/:id/blacklist')
  @Roles('GM', 'ADMIN')
  @ApiOperation({
    summary: 'Blacklist a guest — MANUAL ONLY. This action must NEVER be automated.',
    description:
      'HARD LIMIT: Guest blacklisting is a manual-only action that requires explicit authorisation from a GM or Admin. It must never be triggered automatically by any AI, rule engine, or system process.',
  })
  blacklistGuest(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: BlacklistGuestDto,
    @CurrentUser('sub') userId: string,
  ) {
    // HARD LIMIT: Guest blacklisting is always manual — never automated by AI or system rules
    return this.crmService.blacklistGuest(propertyId, id, dto, userId);
  }

  @Post('guests/:id/unblacklist')
  @Roles('GM', 'ADMIN')
  @ApiOperation({ summary: 'Remove a guest from the blacklist' })
  removeFromBlacklist(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.crmService.removeFromBlacklist(propertyId, id, userId);
  }

  // ─── Stay History & Spend ─────────────────────────────────────────

  @Get('guests/:id/stay-history')
  @ApiOperation({ summary: 'Get stay history for a guest' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getStayHistory(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.crmService.getGuestStayHistory(propertyId, id, (page - 1) * limit, limit);
  }

  @Get('guests/:id/spend-summary')
  @ApiOperation({ summary: 'Get spend summary for a guest across all folios and POS bills' })
  getSpendSummary(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.crmService.getGuestSpendSummary(propertyId, id);
  }

  // ─── Merge ────────────────────────────────────────────────────────

  @Post('guests/merge')
  @Roles('GM', 'ADMIN')
  @ApiOperation({ summary: 'Merge a source guest profile into a target profile' })
  mergeProfiles(
    @PropertyId() propertyId: string,
    @Body() body: { sourceId: string; targetId: string },
  ) {
    return this.crmService.mergeGuestProfiles(propertyId, body.sourceId, body.targetId);
  }
}
