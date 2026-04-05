import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { EventBookingStatus, SetupStyle } from '@prisma/client';
import { CreateEventBookingDto } from './dto/create-event-booking.dto';
import { CreateFunctionSheetDto } from './dto/create-function-sheet.dto';
import { CreateBanquetOrderDto } from './dto/create-banquet-order.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────
  //  EVENT BOOKINGS
  // ─────────────────────────────────────────────────────────

  async createEventBooking(propertyId: string, dto: CreateEventBookingDto) {
    const start = new Date(dto.startDateTime);
    const end = new Date(dto.endDateTime);

    if (end <= start) {
      throw new BadRequestException('End date/time must be after start date/time');
    }

    const bookingNumber = `EVT-${Date.now()}`;

    return this.prisma.eventBooking.create({
      data: {
        propertyId,
        bookingNumber,
        guestProfileId: dto.guestProfileId,
        organizerName: dto.organizerName,
        organizerEmail: dto.organizerEmail,
        organizerPhone: dto.organizerPhone,
        eventName: dto.eventName,
        eventType: dto.eventType,
        status: EventBookingStatus.INQUIRY,
        startDateTime: start,
        endDateTime: end,
        attendeesCount: dto.attendeesCount,
        venueRooms: dto.venueRooms ?? [],
        totalAmount: dto.totalAmount ?? 0,
        depositAmount: dto.depositAmount ?? 0,
        depositPaid: dto.depositPaid ?? false,
        notes: dto.notes,
      },
    });
  }

  async getEventBooking(propertyId: string, id: string) {
    const booking = await this.prisma.eventBooking.findFirst({
      where: { id, propertyId },
      include: {
        functionSheets: {
          include: {
            equipmentItems: true,
            roomSetups: true,
          },
        },
        banquetOrders: true,
      },
    });
    if (!booking) throw new NotFoundException('Event booking not found');
    return booking;
  }

  async listEventBookings(
    propertyId: string,
    params: {
      status?: EventBookingStatus;
      fromDate?: string;
      toDate?: string;
      skip?: number;
      take?: number;
    },
  ) {
    const { status, fromDate, toDate, skip = 0, take = 20 } = params;

    const where: any = { propertyId };
    if (status) where.status = status;
    if (fromDate || toDate) {
      where.startDateTime = {};
      if (fromDate) where.startDateTime.gte = new Date(fromDate);
      if (toDate) where.startDateTime.lte = new Date(toDate);
    }

    const [bookings, total] = await Promise.all([
      this.prisma.eventBooking.findMany({
        where,
        orderBy: { startDateTime: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.eventBooking.count({ where }),
    ]);

    return { bookings, total, skip, take };
  }

  async updateEventBooking(
    propertyId: string,
    id: string,
    dto: Partial<CreateEventBookingDto>,
  ) {
    const booking = await this.prisma.eventBooking.findFirst({
      where: { id, propertyId },
    });
    if (!booking) throw new NotFoundException('Event booking not found');

    if (
      booking.status === EventBookingStatus.COMPLETED ||
      booking.status === EventBookingStatus.CANCELLED
    ) {
      throw new BadRequestException(`Cannot update a ${booking.status} event booking`);
    }

    return this.prisma.eventBooking.update({
      where: { id },
      data: {
        ...(dto.organizerName && { organizerName: dto.organizerName }),
        ...(dto.organizerEmail && { organizerEmail: dto.organizerEmail }),
        ...(dto.organizerPhone !== undefined && { organizerPhone: dto.organizerPhone }),
        ...(dto.eventName && { eventName: dto.eventName }),
        ...(dto.eventType && { eventType: dto.eventType }),
        ...(dto.startDateTime && { startDateTime: new Date(dto.startDateTime) }),
        ...(dto.endDateTime && { endDateTime: new Date(dto.endDateTime) }),
        ...(dto.attendeesCount !== undefined && { attendeesCount: dto.attendeesCount }),
        ...(dto.venueRooms && { venueRooms: dto.venueRooms }),
        ...(dto.totalAmount !== undefined && { totalAmount: dto.totalAmount }),
        ...(dto.depositAmount !== undefined && { depositAmount: dto.depositAmount }),
        ...(dto.depositPaid !== undefined && { depositPaid: dto.depositPaid }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async updateEventBookingStatus(
    propertyId: string,
    id: string,
    status: EventBookingStatus,
  ) {
    const booking = await this.prisma.eventBooking.findFirst({
      where: { id, propertyId },
    });
    if (!booking) throw new NotFoundException('Event booking not found');

    return this.prisma.eventBooking.update({
      where: { id },
      data: { status },
    });
  }

  async cancelEventBooking(propertyId: string, id: string) {
    return this.updateEventBookingStatus(propertyId, id, EventBookingStatus.CANCELLED);
  }

  // ─────────────────────────────────────────────────────────
  //  FUNCTION SHEETS
  // ─────────────────────────────────────────────────────────

  async createFunctionSheet(propertyId: string, dto: CreateFunctionSheetDto) {
    const booking = await this.prisma.eventBooking.findFirst({
      where: { id: dto.eventBookingId, propertyId },
    });
    if (!booking) throw new NotFoundException('Event booking not found');

    return this.prisma.functionSheet.create({
      data: {
        propertyId,
        eventBookingId: dto.eventBookingId,
        venueName: dto.venueName,
        setupStyle: dto.setupStyle,
        capacityUsed: dto.capacityUsed,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        decorNotes: dto.decorNotes,
        avNotes: dto.avNotes,
        cateringNotes: dto.cateringNotes,
        staffNotes: dto.staffNotes,
        setupTime: dto.setupTime ? new Date(dto.setupTime) : null,
        breakdownTime: dto.breakdownTime ? new Date(dto.breakdownTime) : null,
        isConfirmed: dto.isConfirmed ?? false,
      },
      include: { equipmentItems: true, roomSetups: true },
    });
  }

  async updateFunctionSheet(
    propertyId: string,
    id: string,
    dto: Partial<CreateFunctionSheetDto>,
  ) {
    const sheet = await this.prisma.functionSheet.findFirst({
      where: { id, propertyId },
    });
    if (!sheet) throw new NotFoundException('Function sheet not found');

    if (sheet.isConfirmed) {
      throw new BadRequestException('Cannot edit a confirmed function sheet');
    }

    return this.prisma.functionSheet.update({
      where: { id },
      data: {
        ...(dto.venueName && { venueName: dto.venueName }),
        ...(dto.setupStyle && { setupStyle: dto.setupStyle }),
        ...(dto.capacityUsed !== undefined && { capacityUsed: dto.capacityUsed }),
        ...(dto.startTime && { startTime: new Date(dto.startTime) }),
        ...(dto.endTime && { endTime: new Date(dto.endTime) }),
        ...(dto.decorNotes !== undefined && { decorNotes: dto.decorNotes }),
        ...(dto.avNotes !== undefined && { avNotes: dto.avNotes }),
        ...(dto.cateringNotes !== undefined && { cateringNotes: dto.cateringNotes }),
        ...(dto.staffNotes !== undefined && { staffNotes: dto.staffNotes }),
        ...(dto.setupTime !== undefined && { setupTime: dto.setupTime ? new Date(dto.setupTime) : null }),
        ...(dto.breakdownTime !== undefined && { breakdownTime: dto.breakdownTime ? new Date(dto.breakdownTime) : null }),
      },
      include: { equipmentItems: true, roomSetups: true },
    });
  }

  async finalizeFunctionSheet(propertyId: string, id: string) {
    const sheet = await this.prisma.functionSheet.findFirst({
      where: { id, propertyId },
    });
    if (!sheet) throw new NotFoundException('Function sheet not found');
    if (sheet.isConfirmed) throw new BadRequestException('Function sheet is already confirmed');

    return this.prisma.functionSheet.update({
      where: { id },
      data: { isConfirmed: true },
    });
  }

  async addEquipmentToSheet(
    propertyId: string,
    sheetId: string,
    equipment: {
      itemName: string;
      category: string;
      quantity: number;
      unitCost?: number;
      supplier?: string;
      notes?: string;
    },
  ) {
    const sheet = await this.prisma.functionSheet.findFirst({
      where: { id: sheetId, propertyId },
    });
    if (!sheet) throw new NotFoundException('Function sheet not found');
    if (sheet.isConfirmed) throw new BadRequestException('Cannot add equipment to a confirmed function sheet');

    return this.prisma.eventEquipment.create({
      data: {
        functionSheetId: sheetId,
        itemName: equipment.itemName,
        category: equipment.category,
        quantity: equipment.quantity,
        unitCost: equipment.unitCost ?? 0,
        supplier: equipment.supplier,
        notes: equipment.notes,
      },
    });
  }

  async addRoomSetup(
    propertyId: string,
    sheetId: string,
    setup: {
      roomName: string;
      setupStyle: SetupStyle;
      capacity: number;
      notes?: string;
    },
  ) {
    const sheet = await this.prisma.functionSheet.findFirst({
      where: { id: sheetId, propertyId },
    });
    if (!sheet) throw new NotFoundException('Function sheet not found');
    if (sheet.isConfirmed) throw new BadRequestException('Cannot add room setup to a confirmed function sheet');

    return this.prisma.roomSetupConfig.create({
      data: {
        functionSheetId: sheetId,
        roomName: setup.roomName,
        setupStyle: setup.setupStyle,
        capacity: setup.capacity,
        notes: setup.notes,
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  BANQUET ORDERS
  // ─────────────────────────────────────────────────────────

  async createBanquetOrder(propertyId: string, dto: CreateBanquetOrderDto) {
    const booking = await this.prisma.eventBooking.findFirst({
      where: { id: dto.eventBookingId, propertyId },
    });
    if (!booking) throw new NotFoundException('Event booking not found');

    const totalCost = +(dto.perPersonCost * dto.totalGuests).toFixed(2);
    const orderNumber = `BO-${Date.now()}`;

    return this.prisma.banquetOrder.create({
      data: {
        propertyId,
        eventBookingId: dto.eventBookingId,
        orderNumber,
        menuPackage: dto.menuPackage,
        perPersonCost: dto.perPersonCost,
        totalGuests: dto.totalGuests,
        totalCost,
        dietaryNotes: dto.dietaryNotes,
        beveragePackage: dto.beveragePackage,
        staffRequired: dto.staffRequired ?? 0,
        notes: dto.notes,
      },
    });
  }

  async getBanquetOrder(propertyId: string, id: string) {
    const order = await this.prisma.banquetOrder.findFirst({
      where: { id, propertyId },
      include: { eventBooking: true },
    });
    if (!order) throw new NotFoundException('Banquet order not found');
    return order;
  }

  async confirmBanquetOrder(propertyId: string, id: string) {
    const order = await this.prisma.banquetOrder.findFirst({
      where: { id, propertyId },
    });
    if (!order) throw new NotFoundException('Banquet order not found');
    if (order.confirmedAt) throw new BadRequestException('Banquet order is already confirmed');

    return this.prisma.banquetOrder.update({
      where: { id },
      data: { confirmedAt: new Date() },
    });
  }
}
