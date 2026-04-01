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

import { HcmService } from './hcm.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { CreateShiftDto } from './dto/create-shift.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { RunPayrollDto } from './dto/run-payroll.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PropertyId } from '../../common/decorators/property-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('hcm')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hcm')
export class HcmController {
  constructor(private readonly hcmService: HcmService) {}

  // ─────────────────────────────────────────────────────────
  //  DEPARTMENTS
  // ─────────────────────────────────────────────────────────

  @Post('departments')
  @Roles('GM', 'ADMIN')
  @ApiOperation({ summary: 'Create a department' })
  createDepartment(
    @PropertyId() propertyId: string,
    @Body('name') name: string,
    @Body('code') code: string,
  ) {
    return this.hcmService.createDepartment(propertyId, name, code);
  }

  @Get('departments')
  @ApiOperation({ summary: 'List all departments' })
  listDepartments(@PropertyId() propertyId: string) {
    return this.hcmService.listDepartments(propertyId);
  }

  @Get('departments/:id')
  @ApiOperation({ summary: 'Get a department with positions and staff' })
  getDepartment(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.hcmService.getDepartment(propertyId, id);
  }

  @Patch('departments/:id')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Update department name or manager' })
  updateDepartment(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body('name') name: string,
    @Body('managerId') managerId?: string,
  ) {
    return this.hcmService.updateDepartment(propertyId, id, name, managerId);
  }

  // ─────────────────────────────────────────────────────────
  //  POSITIONS
  // ─────────────────────────────────────────────────────────

  @Post('positions')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Create a position within a department' })
  createPosition(
    @PropertyId() propertyId: string,
    @Body('departmentId') departmentId: string,
    @Body('title') title: string,
    @Body('description') description?: string,
  ) {
    return this.hcmService.createPosition(propertyId, departmentId, title, description);
  }

  @Get('positions')
  @ApiOperation({ summary: 'List positions, optionally filtered by department' })
  @ApiQuery({ name: 'departmentId', required: false, type: String })
  listPositions(
    @PropertyId() propertyId: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.hcmService.listPositions(propertyId, departmentId);
  }

  // ─────────────────────────────────────────────────────────
  //  STAFF
  // ─────────────────────────────────────────────────────────

  @Post('staff')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Create a staff record linked to a user account' })
  createStaff(@PropertyId() propertyId: string, @Body() dto: CreateStaffDto) {
    return this.hcmService.createStaff(propertyId, dto);
  }

  @Get('staff')
  @ApiOperation({ summary: 'List active staff, optionally filtered by department' })
  @ApiQuery({ name: 'departmentId', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listStaff(
    @PropertyId() propertyId: string,
    @Query('departmentId') departmentId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.hcmService.listStaff(propertyId, { departmentId, skip, take });
  }

  @Get('staff/:id')
  @ApiOperation({ summary: 'Get a staff member with shifts and attendance summary' })
  getStaff(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.hcmService.getStaff(propertyId, id);
  }

  @Patch('staff/:id')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Update a staff record' })
  updateStaff(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateStaffDto>,
  ) {
    return this.hcmService.updateStaff(propertyId, id, dto);
  }

  @Post('staff/:id/terminate')
  @Roles('GM', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Terminate a staff member' })
  terminateStaff(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body('terminationDate') terminationDate: string,
  ) {
    return this.hcmService.terminateStaff(propertyId, id, terminationDate);
  }

  // ─────────────────────────────────────────────────────────
  //  SHIFTS
  // ─────────────────────────────────────────────────────────

  @Post('shifts')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Create a shift for a staff member' })
  createShift(@PropertyId() propertyId: string, @Body() dto: CreateShiftDto) {
    return this.hcmService.createShift(propertyId, dto);
  }

  @Get('shifts')
  @ApiOperation({ summary: 'List shifts with optional filters' })
  @ApiQuery({ name: 'staffId', required: false, type: String })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listShifts(
    @PropertyId() propertyId: string,
    @Query('staffId') staffId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.hcmService.listShifts(propertyId, { staffId, fromDate, toDate, skip, take });
  }

  @Patch('shifts/:id')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Update a shift (cannot update confirmed shifts)' })
  updateShift(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateShiftDto>,
  ) {
    return this.hcmService.updateShift(propertyId, id, dto);
  }

  @Delete('shifts/:id')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an unconfirmed shift' })
  deleteShift(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.hcmService.deleteShift(propertyId, id);
  }

  // ─────────────────────────────────────────────────────────
  //  ATTENDANCE
  // ─────────────────────────────────────────────────────────

  @Post('attendance')
  @Roles('GM', 'ADMIN', 'DEPT_MANAGER', 'SUPERVISOR')
  @ApiOperation({ summary: 'Record attendance for a staff member' })
  recordAttendance(
    @PropertyId() propertyId: string,
    @Body() dto: RecordAttendanceDto,
    @CurrentUser() user: any,
  ) {
    return this.hcmService.recordAttendance(propertyId, dto, user.id);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'List attendance records with optional filters' })
  @ApiQuery({ name: 'staffId', required: false, type: String })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listAttendance(
    @PropertyId() propertyId: string,
    @Query('staffId') staffId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.hcmService.listAttendance(propertyId, { staffId, fromDate, toDate, skip, take });
  }

  // ─────────────────────────────────────────────────────────
  //  PAYROLL
  // ─────────────────────────────────────────────────────────

  @Post('payroll/run')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Run payroll for a period — calculates gross, deductions, net for all staff' })
  runPayroll(
    @PropertyId() propertyId: string,
    @Body() dto: RunPayrollDto,
    @CurrentUser() user: any,
  ) {
    return this.hcmService.runPayroll(propertyId, dto, user.id);
  }

  @Get('payroll')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'List payroll runs (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listPayrollRuns(
    @PropertyId() propertyId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.hcmService.listPayrollRuns(propertyId, skip, take);
  }

  @Get('payroll/:id')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Get a payroll run with all individual items' })
  getPayrollRun(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.hcmService.getPayrollRun(propertyId, id);
  }

  @Post('payroll/:id/approve')
  @Roles('GM', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a draft payroll run' })
  approvePayrollRun(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.hcmService.approvePayrollRun(propertyId, id, user.id);
  }
}
