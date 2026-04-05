import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { CreateShiftDto } from './dto/create-shift.dto';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { RunPayrollDto } from './dto/run-payroll.dto';

// 20% income tax rate; no dynamic tax tables in scope
const TAX_RATE = 0.20;
// 5% pension deduction
const PENSION_RATE = 0.05;

@Injectable()
export class HcmService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────
  //  DEPARTMENTS
  // ─────────────────────────────────────────────────────────

  async createDepartment(propertyId: string, name: string, code: string) {
    const existing = await this.prisma.department.findFirst({
      where: { propertyId, code },
    });
    if (existing) {
      throw new ConflictException(`Department code '${code}' already exists`);
    }

    return this.prisma.department.create({
      data: { propertyId, name, code },
    });
  }

  async listDepartments(propertyId: string) {
    return this.prisma.department.findMany({
      where: { propertyId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { staff: true, positions: true } },
      },
    });
  }

  async getDepartment(propertyId: string, id: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id, propertyId },
      include: {
        positions: { where: { isActive: true } },
        staff: { where: { isActive: true }, include: { position: true } },
      },
    });
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async updateDepartment(propertyId: string, id: string, name: string, managerId?: string) {
    const dept = await this.prisma.department.findFirst({ where: { id, propertyId } });
    if (!dept) throw new NotFoundException('Department not found');

    return this.prisma.department.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(managerId !== undefined && { managerId }),
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  POSITIONS
  // ─────────────────────────────────────────────────────────

  async createPosition(propertyId: string, departmentId: string, title: string, description?: string) {
    const dept = await this.prisma.department.findFirst({ where: { id: departmentId, propertyId } });
    if (!dept) throw new NotFoundException('Department not found');

    return this.prisma.position.create({
      data: { propertyId, departmentId, title, description },
    });
  }

  async listPositions(propertyId: string, departmentId?: string) {
    return this.prisma.position.findMany({
      where: { propertyId, ...(departmentId && { departmentId }), isActive: true },
      orderBy: { title: 'asc' },
      include: { department: true, _count: { select: { staff: true } } },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  STAFF
  // ─────────────────────────────────────────────────────────

  async createStaff(propertyId: string, dto: CreateStaffDto) {
    // Employee number must be unique per property
    const existing = await this.prisma.staff.findFirst({
      where: { propertyId, employeeNumber: dto.employeeNumber },
    });
    if (existing) {
      throw new ConflictException(`Employee number '${dto.employeeNumber}' already exists`);
    }

    // Verify user exists and belongs to this property
    const user = await this.prisma.user.findFirst({ where: { id: dto.userId, propertyId } });
    if (!user) throw new NotFoundException('User not found for this property');

    // Check user doesn't already have a staff profile
    const existingProfile = await this.prisma.staff.findFirst({ where: { userId: dto.userId } });
    if (existingProfile) {
      throw new ConflictException('This user already has a staff profile');
    }

    const dept = await this.prisma.department.findFirst({ where: { id: dto.departmentId, propertyId } });
    if (!dept) throw new NotFoundException('Department not found');

    const position = await this.prisma.position.findFirst({ where: { id: dto.positionId, propertyId } });
    if (!position) throw new NotFoundException('Position not found');

    return this.prisma.staff.create({
      data: {
        propertyId,
        userId: dto.userId,
        departmentId: dto.departmentId,
        positionId: dto.positionId,
        employeeNumber: dto.employeeNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        hireDate: new Date(dto.hireDate),
        baseSalary: dto.baseSalary,
        bankAccountNo: dto.bankAccountNo,
        emergencyContact: dto.emergencyContact,
      },
      include: { department: true, position: true },
    });
  }

  async listStaff(propertyId: string, params: { departmentId?: string; skip?: number; take?: number }) {
    const { departmentId, skip = 0, take = 20 } = params;

    const where: any = { propertyId, isActive: true };
    if (departmentId) where.departmentId = departmentId;

    const [staff, total] = await Promise.all([
      this.prisma.staff.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: Number(skip),
        take: Number(take),
        include: { department: true, position: true },
      }),
      this.prisma.staff.count({ where }),
    ]);

    return { staff, total, skip, take };
  }

  async getStaff(propertyId: string, id: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id, propertyId },
      include: {
        department: true,
        position: true,
        shifts: { orderBy: { startTime: 'desc' }, take: 10 },
        attendance: { orderBy: { date: 'desc' }, take: 30 },
      },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }

  async updateStaff(propertyId: string, id: string, dto: Partial<CreateStaffDto>) {
    const staff = await this.prisma.staff.findFirst({ where: { id, propertyId } });
    if (!staff) throw new NotFoundException('Staff member not found');

    return this.prisma.staff.update({
      where: { id },
      data: {
        ...(dto.departmentId && { departmentId: dto.departmentId }),
        ...(dto.positionId && { positionId: dto.positionId }),
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.email && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.baseSalary !== undefined && { baseSalary: dto.baseSalary }),
        ...(dto.bankAccountNo !== undefined && { bankAccountNo: dto.bankAccountNo }),
        ...(dto.emergencyContact !== undefined && { emergencyContact: dto.emergencyContact }),
      },
      include: { department: true, position: true },
    });
  }

  async terminateStaff(propertyId: string, id: string, terminationDate: string) {
    const staff = await this.prisma.staff.findFirst({ where: { id, propertyId } });
    if (!staff) throw new NotFoundException('Staff member not found');
    if (!staff.isActive) throw new BadRequestException('Staff member is already terminated');

    return this.prisma.staff.update({
      where: { id },
      data: {
        isActive: false,
        terminationDate: new Date(terminationDate),
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  SHIFTS
  // ─────────────────────────────────────────────────────────

  async createShift(propertyId: string, dto: CreateShiftDto) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: dto.staffId, propertyId, isActive: true },
    });
    if (!staff) throw new NotFoundException('Active staff member not found');

    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    if (end <= start) {
      throw new BadRequestException('Shift end time must be after start time');
    }

    // Detect overlapping shifts for the same staff member
    const overlap = await this.prisma.shift.findFirst({
      where: {
        staffId: dto.staffId,
        AND: [
          { startTime: { lt: end } },
          { endTime: { gt: start } },
        ],
      },
    });
    if (overlap) {
      throw new ConflictException(
        `Shift overlaps with existing shift ${overlap.id} (${overlap.startTime.toISOString()} — ${overlap.endTime.toISOString()})`,
      );
    }

    return this.prisma.shift.create({
      data: {
        propertyId,
        staffId: dto.staffId,
        type: dto.type,
        startTime: start,
        endTime: end,
        breakMinutes: dto.breakMinutes ?? 0,
        notes: dto.notes,
        isConfirmed: dto.isConfirmed ?? false,
      },
      include: { staff: { select: { firstName: true, lastName: true, employeeNumber: true } } },
    });
  }

  async listShifts(
    propertyId: string,
    params: { staffId?: string; fromDate?: string; toDate?: string; skip?: number; take?: number },
  ) {
    const { staffId, fromDate, toDate, skip = 0, take = 50 } = params;

    const where: any = { propertyId };
    if (staffId) where.staffId = staffId;
    if (fromDate || toDate) {
      where.startTime = {};
      if (fromDate) where.startTime.gte = new Date(fromDate);
      if (toDate) where.startTime.lte = new Date(toDate);
    }

    const [shifts, total] = await Promise.all([
      this.prisma.shift.findMany({
        where,
        orderBy: { startTime: 'asc' },
        skip: Number(skip),
        take: Number(take),
        include: { staff: { select: { firstName: true, lastName: true, employeeNumber: true } } },
      }),
      this.prisma.shift.count({ where }),
    ]);

    return { shifts, total, skip, take };
  }

  async updateShift(propertyId: string, id: string, dto: Partial<CreateShiftDto>) {
    const shift = await this.prisma.shift.findFirst({ where: { id, propertyId } });
    if (!shift) throw new NotFoundException('Shift not found');

    const start = dto.startTime ? new Date(dto.startTime) : shift.startTime;
    const end = dto.endTime ? new Date(dto.endTime) : shift.endTime;

    if (end <= start) {
      throw new BadRequestException('Shift end time must be after start time');
    }

    return this.prisma.shift.update({
      where: { id },
      data: {
        ...(dto.type && { type: dto.type }),
        ...(dto.startTime && { startTime: start }),
        ...(dto.endTime && { endTime: end }),
        ...(dto.breakMinutes !== undefined && { breakMinutes: dto.breakMinutes }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.isConfirmed !== undefined && { isConfirmed: dto.isConfirmed }),
      },
    });
  }

  async deleteShift(propertyId: string, id: string) {
    const shift = await this.prisma.shift.findFirst({ where: { id, propertyId } });
    if (!shift) throw new NotFoundException('Shift not found');

    if (shift.isConfirmed) {
      throw new BadRequestException('Cannot delete a confirmed shift');
    }

    await this.prisma.shift.delete({ where: { id } });
    return { deleted: true, id };
  }

  // ─────────────────────────────────────────────────────────
  //  ATTENDANCE
  // ─────────────────────────────────────────────────────────

  async recordAttendance(propertyId: string, dto: RecordAttendanceDto, approverId: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: dto.staffId, propertyId },
    });
    if (!staff) throw new NotFoundException('Staff member not found');

    const attendanceDate = new Date(dto.date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Prevent duplicate attendance records for the same day
    const existing = await this.prisma.attendance.findFirst({
      where: { staffId: dto.staffId, date: attendanceDate },
    });
    if (existing) {
      throw new ConflictException(
        `Attendance already recorded for staff ${dto.staffId} on ${dto.date}`,
      );
    }

    // Auto-calculate hours worked from clock times if not provided
    let hoursWorked = dto.hoursWorked ?? 0;
    let overtime = dto.overtime ?? 0;

    if (dto.clockIn && dto.clockOut && dto.hoursWorked === undefined) {
      const clockIn = new Date(dto.clockIn);
      const clockOut = new Date(dto.clockOut);
      const rawHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      hoursWorked = +Math.max(0, rawHours).toFixed(2);
      const standardHours = 8;
      overtime = +(Math.max(0, hoursWorked - standardHours)).toFixed(2);
    }

    return this.prisma.attendance.create({
      data: {
        propertyId,
        staffId: dto.staffId,
        shiftId: dto.shiftId,
        date: attendanceDate,
        clockIn: dto.clockIn ? new Date(dto.clockIn) : undefined,
        clockOut: dto.clockOut ? new Date(dto.clockOut) : undefined,
        status: dto.status,
        hoursWorked,
        overtime,
        notes: dto.notes,
        approvedById: approverId,
      },
      include: { staff: { select: { firstName: true, lastName: true } }, shift: true },
    });
  }

  async listAttendance(
    propertyId: string,
    params: { staffId?: string; fromDate?: string; toDate?: string; skip?: number; take?: number },
  ) {
    const { staffId, fromDate, toDate, skip = 0, take = 50 } = params;

    const where: any = { propertyId };
    if (staffId) where.staffId = staffId;
    if (fromDate || toDate) {
      where.date = {};
      if (fromDate) where.date.gte = new Date(fromDate);
      if (toDate) where.date.lte = new Date(toDate);
    }

    const [records, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: Number(skip),
        take: Number(take),
        include: { staff: { select: { firstName: true, lastName: true, employeeNumber: true } } },
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return { records, total, skip, take };
  }

  // ─────────────────────────────────────────────────────────
  //  PAYROLL
  // ─────────────────────────────────────────────────────────

  async runPayroll(propertyId: string, dto: RunPayrollDto, userId: string) {
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);

    if (periodEnd <= periodStart) {
      throw new BadRequestException('Payroll period end must be after start');
    }

    // Prevent duplicate payroll run for the same period
    const existing = await this.prisma.payrollRun.findFirst({
      where: {
        propertyId,
        periodStart,
        periodEnd,
        ...(dto.departmentId && {}), // department-scoped runs allowed
      },
    });
    if (existing) {
      throw new ConflictException(
        `A payroll run for ${dto.periodStart} — ${dto.periodEnd} already exists (id: ${existing.id})`,
      );
    }

    // Fetch all active staff for this property (optionally filtered by department)
    const staffList = await this.prisma.staff.findMany({
      where: {
        propertyId,
        isActive: true,
        ...(dto.departmentId && { departmentId: dto.departmentId }),
      },
    });

    if (staffList.length === 0) {
      throw new BadRequestException('No active staff found for this payroll period');
    }

    // Gather attendance data for the period to calculate overtime pay
    const staffIds = staffList.map((s) => s.id);
    const attendanceRecords = await this.prisma.attendance.findMany({
      where: {
        staffId: { in: staffIds },
        date: { gte: periodStart, lte: periodEnd },
      },
    });

    const overtimeByStaff = attendanceRecords.reduce<Record<string, number>>((acc, a) => {
      acc[a.staffId] = (acc[a.staffId] ?? 0) + Number(a.overtime);
      return acc;
    }, {});

    // Calculate payroll items
    const payrollItems = staffList.map((staff) => {
      const monthlySalary = Number(staff.baseSalary) / 12;
      const overtimeHours = overtimeByStaff[staff.id] ?? 0;
      const hourlyRate = monthlySalary / (8 * 22); // 8h/day, ~22 working days
      const overtimePay = +(overtimeHours * hourlyRate * 1.5).toFixed(2);
      const grossPay = +(monthlySalary + overtimePay).toFixed(2);
      const pension = +(grossPay * PENSION_RATE).toFixed(2);
      const taxes = +(grossPay * TAX_RATE).toFixed(2);
      const deductions = +(pension + taxes).toFixed(2);
      const netPay = +(grossPay - deductions).toFixed(2);

      return {
        staffId: staff.id,
        grossPay,
        overtime: overtimePay,
        bonuses: 0,
        deductions,
        taxes,
        netPay,
        breakdown: { monthlySalary, overtimeHours, overtimePay, pension, taxes },
      };
    });

    const totalGross = +payrollItems.reduce((s, i) => s + i.grossPay, 0).toFixed(2);
    const totalDeductions = +payrollItems.reduce((s, i) => s + i.deductions, 0).toFixed(2);
    const totalNet = +payrollItems.reduce((s, i) => s + i.netPay, 0).toFixed(2);

    return this.prisma.payrollRun.create({
      data: {
        propertyId,
        periodStart,
        periodEnd,
        runDate: new Date(),
        totalGross,
        totalDeductions,
        totalNet,
        status: 'draft',
        payrollItems: {
          create: payrollItems,
        },
      },
      include: { payrollItems: { include: { staff: { select: { firstName: true, lastName: true, employeeNumber: true } } } } },
    });
  }

  async getPayrollRun(propertyId: string, id: string) {
    const run = await this.prisma.payrollRun.findFirst({
      where: { id, propertyId },
      include: {
        payrollItems: {
          include: { staff: { select: { firstName: true, lastName: true, employeeNumber: true, department: true } } },
        },
      },
    });
    if (!run) throw new NotFoundException('Payroll run not found');
    return run;
  }

  async listPayrollRuns(propertyId: string, skip = 0, take = 20) {
    const [runs, total] = await Promise.all([
      this.prisma.payrollRun.findMany({
        where: { propertyId },
        orderBy: { runDate: 'desc' },
        skip: Number(skip),
        take: Number(take),
        include: { _count: { select: { payrollItems: true } } },
      }),
      this.prisma.payrollRun.count({ where: { propertyId } }),
    ]);

    return { runs, total, skip, take };
  }

  async approvePayrollRun(propertyId: string, id: string, userId: string) {
    const run = await this.prisma.payrollRun.findFirst({ where: { id, propertyId } });
    if (!run) throw new NotFoundException('Payroll run not found');

    if (run.status !== 'draft') {
      throw new BadRequestException(`Payroll run is already in '${run.status}' status`);
    }

    return this.prisma.payrollRun.update({
      where: { id },
      data: { status: 'approved', approvedById: userId, approvedAt: new Date() },
    });
  }
}
