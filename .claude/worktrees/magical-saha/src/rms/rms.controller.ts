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
import { RmsService } from './rms.service';
import { CreatePricingRuleDto } from './dto/create-pricing-rule.dto';
import { GenerateForecastDto } from './dto/generate-forecast.dto';

@ApiTags('Revenue Management System')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rms')
export class RmsController {
  constructor(private readonly rmsService: RmsService) {}

  // ─── Pricing Rules ────────────────────────────────────────────────

  @Post('pricing-rules')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Create a new dynamic pricing rule' })
  createPricingRule(@PropertyId() propertyId: string, @Body() dto: CreatePricingRuleDto) {
    return this.rmsService.createPricingRule(propertyId, dto);
  }

  @Get('pricing-rules')
  @ApiOperation({ summary: 'List pricing rules, optionally filtered by active status' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  listPricingRules(
    @PropertyId() propertyId: string,
    @Query('isActive') isActive?: string,
  ) {
    const activeFilter = isActive === undefined ? undefined : isActive === 'true';
    return this.rmsService.listPricingRules(propertyId, activeFilter);
  }

  @Patch('pricing-rules/:id')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Update a pricing rule' })
  updatePricingRule(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreatePricingRuleDto>,
  ) {
    return this.rmsService.updatePricingRule(propertyId, id, dto);
  }

  @Delete('pricing-rules/:id')
  @Roles('GM', 'ADMIN')
  @ApiOperation({ summary: 'Deactivate (soft-delete) a pricing rule' })
  deletePricingRule(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.rmsService.deletePricingRule(propertyId, id);
  }

  // ─── Rate Recommendation ──────────────────────────────────────────

  @Get('rate-recommendation')
  @ApiOperation({ summary: 'Calculate recommended rate for a room type on a specific date' })
  @ApiQuery({ name: 'roomTypeId', required: true })
  @ApiQuery({ name: 'date', required: true, description: 'Date in YYYY-MM-DD format' })
  getRateRecommendation(
    @PropertyId() propertyId: string,
    @Query('roomTypeId') roomTypeId: string,
    @Query('date') date: string,
  ) {
    return this.rmsService.calculateRecommendedRate(propertyId, roomTypeId, date);
  }

  // ─── Forecasts ────────────────────────────────────────────────────

  @Post('forecast/generate')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Generate rate and occupancy forecasts for a date range' })
  generateForecast(@PropertyId() propertyId: string, @Body() dto: GenerateForecastDto) {
    return this.rmsService.generateForecast(propertyId, dto);
  }

  @Get('forecasts')
  @ApiOperation({ summary: 'Get stored forecasts for a date range' })
  @ApiQuery({ name: 'fromDate', required: true })
  @ApiQuery({ name: 'toDate', required: true })
  @ApiQuery({ name: 'roomTypeId', required: false })
  getForecasts(
    @PropertyId() propertyId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('roomTypeId') roomTypeId?: string,
  ) {
    return this.rmsService.getForecasts(propertyId, fromDate, toDate, roomTypeId);
  }

  // ─── Revenue Snapshots ────────────────────────────────────────────

  @Post('revenue-snapshot')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Capture or refresh a revenue snapshot for a date (defaults to today)' })
  @ApiQuery({ name: 'date', required: false, description: 'Date YYYY-MM-DD; defaults to today' })
  captureRevenueSnapshot(
    @PropertyId() propertyId: string,
    @Query('date') date?: string,
  ) {
    return this.rmsService.captureRevenueSnapshot(propertyId, date);
  }

  @Get('revenue-snapshots')
  @ApiOperation({ summary: 'Get revenue snapshots for a date range' })
  @ApiQuery({ name: 'fromDate', required: true })
  @ApiQuery({ name: 'toDate', required: true })
  getRevenueSnapshots(
    @PropertyId() propertyId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    return this.rmsService.getRevenueSnapshots(propertyId, fromDate, toDate);
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Get aggregated KPI metrics grouped by period' })
  @ApiQuery({ name: 'period', required: true, enum: ['daily', 'weekly', 'monthly'] })
  @ApiQuery({ name: 'fromDate', required: true })
  @ApiQuery({ name: 'toDate', required: true })
  getRevenueKPIs(
    @PropertyId() propertyId: string,
    @Query('period') period: 'daily' | 'weekly' | 'monthly',
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    return this.rmsService.getRevenueKPIs(propertyId, period, fromDate, toDate);
  }

  // ─── Rate Recommendations ─────────────────────────────────────────

  @Get('rate-recommendations')
  @ApiOperation({ summary: 'Get rate recommendations with variance against current base rates' })
  @ApiQuery({ name: 'fromDate', required: true })
  @ApiQuery({ name: 'toDate', required: true })
  getRateRecommendations(
    @PropertyId() propertyId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    return this.rmsService.getRateRecommendations(propertyId, fromDate, toDate);
  }
}
