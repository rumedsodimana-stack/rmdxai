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

import { MultiPropertyService } from './multi-property.service';
import { CreatePropertyGroupDto } from './dto/create-property-group.dto';
import { AddPropertyToGroupDto } from './dto/add-property-to-group.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('multi-property')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('multi-property')
export class MultiPropertyController {
  constructor(private readonly multiPropertyService: MultiPropertyService) {}

  // ─────────────────────────────────────────────────────────
  //  PROPERTY GROUPS
  // ─────────────────────────────────────────────────────────

  @Post('groups')
  @Roles('ADMIN', 'GM')
  @ApiOperation({ summary: 'Create a new property group' })
  createPropertyGroup(@Body() dto: CreatePropertyGroupDto) {
    return this.multiPropertyService.createPropertyGroup(dto);
  }

  @Get('groups')
  @Roles('ADMIN', 'GM')
  @ApiOperation({ summary: 'List all property groups' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listPropertyGroups(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.multiPropertyService.listPropertyGroups(skip, take);
  }

  @Get('groups/:id')
  @Roles('ADMIN', 'GM')
  @ApiOperation({ summary: 'Get a property group with its members' })
  getPropertyGroup(@Param('id') id: string) {
    return this.multiPropertyService.getPropertyGroup(id);
  }

  @Patch('groups/:id')
  @Roles('ADMIN', 'GM')
  @ApiOperation({ summary: 'Update a property group' })
  updatePropertyGroup(
    @Param('id') id: string,
    @Body() dto: Partial<CreatePropertyGroupDto>,
  ) {
    return this.multiPropertyService.updatePropertyGroup(id, dto);
  }

  @Delete('groups/:id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a property group' })
  deletePropertyGroup(@Param('id') id: string) {
    return this.multiPropertyService.deletePropertyGroup(id);
  }

  // ─────────────────────────────────────────────────────────
  //  MEMBERSHIP
  // ─────────────────────────────────────────────────────────

  @Post('groups/:id/members')
  @Roles('ADMIN', 'GM')
  @ApiOperation({ summary: 'Add a property to a group' })
  addProperty(@Param('id') id: string, @Body() dto: AddPropertyToGroupDto) {
    return this.multiPropertyService.addPropertyToGroup(id, dto);
  }

  @Delete('groups/:id/members/:propertyId')
  @Roles('ADMIN', 'GM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a property from a group' })
  removeProperty(
    @Param('id') groupId: string,
    @Param('propertyId') propertyId: string,
  ) {
    return this.multiPropertyService.removePropertyFromGroup(groupId, propertyId);
  }

  // ─────────────────────────────────────────────────────────
  //  REPORTS
  // ─────────────────────────────────────────────────────────

  @Get('groups/:id/occupancy')
  @Roles('ADMIN', 'GM')
  @ApiOperation({ summary: 'Cross-property occupancy report for a group' })
  occupancyReport(@Param('id') id: string) {
    return this.multiPropertyService.crossPropertyOccupancyReport(id);
  }

  @Get('groups/:id/gm-dashboard')
  @Roles('ADMIN', 'GM')
  @ApiOperation({ summary: 'Centralised GM dashboard — aggregated KPIs across all properties in group' })
  gmDashboard(@Param('id') id: string) {
    return this.multiPropertyService.gmDashboard(id);
  }

  @Get('groups/:id/guest-lookup')
  @Roles('ADMIN', 'GM', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Cross-property guest lookup within a group' })
  @ApiQuery({ name: 'email', required: false, type: String })
  @ApiQuery({ name: 'passportNo', required: false, type: String })
  @ApiQuery({ name: 'phone', required: false, type: String })
  crossPropertyGuestLookup(
    @Param('id') groupId: string,
    @Query('email') email?: string,
    @Query('passportNo') passportNo?: string,
    @Query('phone') phone?: string,
  ) {
    return this.multiPropertyService.crossPropertyGuestLookup(groupId, { email, passportNo, phone });
  }
}
