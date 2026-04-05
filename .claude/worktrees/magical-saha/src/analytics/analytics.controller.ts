import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiProduces,
} from '@nestjs/swagger';
import { Response } from 'express';

import { AnalyticsService } from './analytics.service';
import { KpiQueryDto } from './dto/kpi-query.dto';
import { ReportQueryDto } from './dto/report-query.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PropertyId } from '../../common/decorators/property-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // ─────────────────────────────────────────────────────────
  //  DAILY KPI SNAPSHOT
  // ─────────────────────────────────────────────────────────

  @Get('kpi/daily')
  @ApiOperation({ summary: 'Daily KPI snapshot — occupancy %, RevPAR, ADR, GOPPAR' })
  @ApiQuery({ name: 'date', required: false, type: String, example: '2025-09-15' })
  getDailyKPI(
    @PropertyId() propertyId: string,
    @Query('date') date?: string,
  ) {
    return this.analyticsService.getDailyKPI(propertyId, date);
  }

  // ─────────────────────────────────────────────────────────
  //  WEEKLY / MONTHLY AGGREGATES
  // ─────────────────────────────────────────────────────────

  @Get('kpi/aggregates')
  @ApiOperation({ summary: 'Weekly or monthly KPI aggregates bucketed from daily snapshots' })
  @ApiQuery({ name: 'period', enum: ['weekly', 'monthly'], required: true })
  @ApiQuery({ name: 'fromDate', required: false, type: String, example: '2025-09-01' })
  @ApiQuery({ name: 'toDate', required: false, type: String, example: '2025-09-30' })
  getAggregates(
    @PropertyId() propertyId: string,
    @Query() dto: KpiQueryDto,
  ) {
    return this.analyticsService.getAggregates(propertyId, dto);
  }

  // ─────────────────────────────────────────────────────────
  //  TOP-PERFORMING ROOM TYPES
  // ─────────────────────────────────────────────────────────

  @Get('room-types/top')
  @ApiOperation({ summary: 'Top-performing room types ranked by total revenue' })
  @ApiQuery({ name: 'fromDate', required: true, type: String, example: '2025-09-01' })
  @ApiQuery({ name: 'toDate', required: true, type: String, example: '2025-09-30' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getTopRoomTypes(
    @PropertyId() propertyId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('limit') limit = '10',
  ) {
    return this.analyticsService.getTopRoomTypes(propertyId, fromDate, toDate, parseInt(limit, 10));
  }

  // ─────────────────────────────────────────────────────────
  //  REVENUE BY OUTLET
  // ─────────────────────────────────────────────────────────

  @Get('revenue/by-outlet')
  @ApiOperation({ summary: 'POS revenue breakdown by outlet for a date range' })
  @ApiQuery({ name: 'fromDate', required: true, type: String, example: '2025-09-01' })
  @ApiQuery({ name: 'toDate', required: true, type: String, example: '2025-09-30' })
  getRevenueByOutlet(
    @PropertyId() propertyId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    return this.analyticsService.getRevenueByOutlet(propertyId, fromDate, toDate);
  }

  // ─────────────────────────────────────────────────────────
  //  REPORTS — generate and retrieve
  // ─────────────────────────────────────────────────────────

  @Post('reports')
  @Roles('GM', 'ADMIN', 'FINANCE', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Generate and persist a report for a given type and date range' })
  generateReport(
    @PropertyId() propertyId: string,
    @Body() dto: ReportQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.analyticsService.generateReport(propertyId, dto, user.id);
  }

  @Get('reports')
  @ApiOperation({ summary: 'List previously generated reports' })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listReports(
    @PropertyId() propertyId: string,
    @Query('type') type?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.analyticsService.listReports(propertyId, { type, skip, take });
  }

  @Get('reports/:id')
  @ApiOperation({ summary: 'Get a single report with its data payload' })
  getReport(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.analyticsService.getReport(propertyId, id);
  }

  // ─────────────────────────────────────────────────────────
  //  CSV EXPORT
  // ─────────────────────────────────────────────────────────

  @Get('export/kpi-csv')
  @Roles('GM', 'ADMIN', 'FINANCE', 'DEPT_MANAGER')
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Export daily KPI snapshots as CSV' })
  @ApiQuery({ name: 'fromDate', required: true, type: String, example: '2025-09-01' })
  @ApiQuery({ name: 'toDate', required: true, type: String, example: '2025-09-30' })
  async exportKpiCsv(
    @PropertyId() propertyId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Res() res: Response,
  ) {
    const csv = await this.analyticsService.exportKpiCsv(propertyId, fromDate, toDate);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="kpi_${fromDate}_${toDate}.csv"`,
    });
    res.send(csv);
  }

  @Get('export/outlet-revenue-csv')
  @Roles('GM', 'ADMIN', 'FINANCE', 'DEPT_MANAGER')
  @ApiProduces('text/csv')
  @ApiOperation({ summary: 'Export revenue-by-outlet breakdown as CSV' })
  @ApiQuery({ name: 'fromDate', required: true, type: String, example: '2025-09-01' })
  @ApiQuery({ name: 'toDate', required: true, type: String, example: '2025-09-30' })
  async exportRevenueByOutletCsv(
    @PropertyId() propertyId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Res() res: Response,
  ) {
    const csv = await this.analyticsService.exportRevenueByOutletCsv(propertyId, fromDate, toDate);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="outlet_revenue_${fromDate}_${toDate}.csv"`,
    });
    res.send(csv);
  }
}
