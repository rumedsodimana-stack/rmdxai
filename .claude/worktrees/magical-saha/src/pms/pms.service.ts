import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { RoomStatus, ReservationStatus, FolioStatus } from '@prisma/client';
import { CreateRoomTypeDto } from './dto/create-room-type.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomStatusDto } from './dto/update-room-status.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { CreateFolioItemDto } from './dto/create-folio-item.dto';

@Injectable()
export class PmsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────
  //  ROOM TYPES
  // ─────────────────────────────────────────────────────────

  async createRoomType(propertyId: string, dto: CreateRoomTypeDto) {
    const existing = await this.prisma.roomType.findFirst({
      where: { propertyId, code: dto.code },
    });
    if (existing) {
      throw new ConflictException(`Room type code '${dto.code}' already exists for this property`);
    }

    return this.prisma.roomType.create({
      data: {
        propertyId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        maxOccupancy: dto.maxOccupancy,
        baseRate: dto.baseRate,
        amenities: dto.amenities,
        bedType: dto.bedType,
        sizeSqm: dto.sizeSqm,
      },
    });
  }

  async listRoomTypes(propertyId: string) {
    return this.prisma.roomType.findMany({
      where: { propertyId, isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { rooms: true } } },
    });
  }

  async updateRoomType(propertyId: string, id: string, dto: Partial<CreateRoomTypeDto>) {
    const roomType = await this.prisma.roomType.findFirst({
      where: { id, propertyId },
    });
    if (!roomType) throw new NotFoundException('Room type not found');

    // If code is changing, ensure no collision
    if (dto.code && dto.code !== roomType.code) {
      const collision = await this.prisma.roomType.findFirst({
        where: { propertyId, code: dto.code, id: { not: id } },
      });
      if (collision) {
        throw new ConflictException(`Room type code '${dto.code}' already exists for this property`);
      }
    }

    return this.prisma.roomType.update({
      where: { id },
      data: {
        ...(dto.code && { code: dto.code }),
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.maxOccupancy !== undefined && { maxOccupancy: dto.maxOccupancy }),
        ...(dto.baseRate !== undefined && { baseRate: dto.baseRate }),
        ...(dto.amenities && { amenities: dto.amenities }),
        ...(dto.bedType && { bedType: dto.bedType }),
        ...(dto.sizeSqm !== undefined && { sizeSqm: dto.sizeSqm }),
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  ROOMS
  // ─────────────────────────────────────────────────────────

  async createRoom(propertyId: string, dto: CreateRoomDto) {
    // Verify room type belongs to this property
    const roomType = await this.prisma.roomType.findFirst({
      where: { id: dto.roomTypeId, propertyId },
    });
    if (!roomType) throw new NotFoundException('Room type not found');

    const existing = await this.prisma.room.findFirst({
      where: { propertyId, number: dto.number },
    });
    if (existing) {
      throw new ConflictException(`Room number '${dto.number}' already exists for this property`);
    }

    return this.prisma.room.create({
      data: {
        propertyId,
        roomTypeId: dto.roomTypeId,
        number: dto.number,
        floor: dto.floor,
        notes: dto.notes,
        status: RoomStatus.CLEAN,
      },
      include: { roomType: true },
    });
  }

  async listRooms(propertyId: string, status?: RoomStatus) {
    return this.prisma.room.findMany({
      where: {
        propertyId,
        ...(status && { status }),
      },
      include: { roomType: true },
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
    });
  }

  async getRoom(propertyId: string, id: string) {
    const room = await this.prisma.room.findFirst({
      where: { id, propertyId },
      include: {
        roomType: true,
        reservations: {
          where: {
            status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
          },
          orderBy: { checkInDate: 'asc' },
          take: 5,
        },
      },
    });
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  async updateRoomStatus(propertyId: string, id: string, dto: UpdateRoomStatusDto) {
    const room = await this.prisma.room.findFirst({ where: { id, propertyId } });
    if (!room) throw new NotFoundException('Room not found');

    // HARD LIMIT: never auto-update to CLEAN without housekeeper sign-off
    if (dto.status === RoomStatus.CLEAN) {
      throw new BadRequestException(
        'Room cannot be marked CLEAN directly. Use the housekeeper inspection endpoint instead.',
      );
    }

    const isOOO = dto.status === RoomStatus.OUT_OF_ORDER;

    return this.prisma.room.update({
      where: { id },
      data: {
        status: dto.status,
        isOOO,
        oooReason: isOOO ? dto.oooReason : null,
        oooFrom: isOOO && dto.oooFrom ? new Date(dto.oooFrom) : null,
        oooUntil: isOOO && dto.oooUntil ? new Date(dto.oooUntil) : null,
      },
    });
  }

  async markHousekeeperInspected(propertyId: string, id: string, inspectorId: string) {
    const room = await this.prisma.room.findFirst({ where: { id, propertyId } });
    if (!room) throw new NotFoundException('Room not found');

    if (room.status === RoomStatus.OCCUPIED_CLEAN || room.status === RoomStatus.OCCUPIED_DIRTY) {
      throw new BadRequestException('Cannot inspect an occupied room');
    }

    if (room.status === RoomStatus.OUT_OF_ORDER) {
      throw new BadRequestException('Out-of-order rooms cannot be marked inspected');
    }

    // Only DIRTY or INSPECTED rooms can be signed off as CLEAN
    if (room.status !== RoomStatus.DIRTY && room.status !== RoomStatus.INSPECTED) {
      throw new BadRequestException(`Room status '${room.status}' cannot be transitioned to CLEAN via inspection`);
    }

    return this.prisma.room.update({
      where: { id },
      data: {
        status: RoomStatus.CLEAN,
        isOOO: false,
        oooReason: null,
        oooFrom: null,
        oooUntil: null,
        notes: room.notes
          ? `${room.notes} | Inspected by ${inspectorId} at ${new Date().toISOString()}`
          : `Inspected by ${inspectorId} at ${new Date().toISOString()}`,
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  RESERVATIONS
  // ─────────────────────────────────────────────────────────

  async createReservation(propertyId: string, dto: CreateReservationDto) {
    const checkIn = new Date(dto.checkInDate);
    const checkOut = new Date(dto.checkOutDate);

    if (checkOut <= checkIn) {
      throw new BadRequestException('Check-out date must be after check-in date');
    }

    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
    );
    const totalAmount = dto.rateAmount * nights;

    // Verify room type belongs to this property
    const roomType = await this.prisma.roomType.findFirst({
      where: { id: dto.roomTypeId, propertyId },
    });
    if (!roomType) throw new NotFoundException('Room type not found');

    // Check room type availability: ensure enough non-conflicting reservations
    const overlappingCount = await this.prisma.reservation.count({
      where: {
        propertyId,
        roomTypeId: dto.roomTypeId,
        status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
        AND: [
          { checkInDate: { lt: checkOut } },
          { checkOutDate: { gt: checkIn } },
        ],
      },
    });

    const totalRoomsOfType = await this.prisma.room.count({
      where: { propertyId, roomTypeId: dto.roomTypeId, isOOO: false },
    });

    if (overlappingCount >= totalRoomsOfType) {
      throw new ConflictException(
        'No availability for the selected room type on those dates',
      );
    }

    const confirmationNo = `SPM-${Date.now()}`;

    return this.prisma.reservation.create({
      data: {
        propertyId,
        guestProfileId: dto.guestProfileId,
        roomTypeId: dto.roomTypeId,
        confirmationNo,
        status: ReservationStatus.CONFIRMED,
        source: dto.source ?? 'DIRECT',
        checkInDate: checkIn,
        checkOutDate: checkOut,
        adults: dto.adults ?? 1,
        children: dto.children ?? 0,
        rateCode: dto.rateCode,
        rateAmount: dto.rateAmount,
        totalAmount,
        specialRequests: dto.specialRequests,
        arrivalTime: dto.arrivalTime,
      },
      include: {
        guestProfile: true,
      },
    });
  }

  async getReservation(propertyId: string, id: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, propertyId },
      include: {
        guestProfile: true,
        room: { include: { roomType: true } },
        folio: { include: { items: { where: { isVoid: false } } } },
      },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');
    return reservation;
  }

  async listReservations(
    propertyId: string,
    params: {
      status?: ReservationStatus;
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
      where.checkInDate = {};
      if (fromDate) where.checkInDate.gte = new Date(fromDate);
      if (toDate) where.checkInDate.lte = new Date(toDate);
    }

    const [reservations, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        include: { guestProfile: true, room: true },
        orderBy: { checkInDate: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.reservation.count({ where }),
    ]);

    return { reservations, total, skip, take };
  }

  async updateReservation(
    propertyId: string,
    id: string,
    dto: Partial<CreateReservationDto>,
  ) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, propertyId },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');

    if (
      reservation.status === ReservationStatus.CHECKED_OUT ||
      reservation.status === ReservationStatus.CANCELLED ||
      reservation.status === ReservationStatus.NO_SHOW
    ) {
      throw new BadRequestException(`Cannot update a ${reservation.status} reservation`);
    }

    const checkIn = dto.checkInDate ? new Date(dto.checkInDate) : reservation.checkInDate;
    const checkOut = dto.checkOutDate ? new Date(dto.checkOutDate) : reservation.checkOutDate;
    const rateAmount = dto.rateAmount ?? Number(reservation.rateAmount);
    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
    );
    const totalAmount = rateAmount * nights;

    return this.prisma.reservation.update({
      where: { id },
      data: {
        ...(dto.guestProfileId !== undefined && { guestProfileId: dto.guestProfileId }),
        ...(dto.roomTypeId && { roomTypeId: dto.roomTypeId }),
        ...(dto.checkInDate && { checkInDate: checkIn }),
        ...(dto.checkOutDate && { checkOutDate: checkOut }),
        ...(dto.adults !== undefined && { adults: dto.adults }),
        ...(dto.children !== undefined && { children: dto.children }),
        ...(dto.rateCode !== undefined && { rateCode: dto.rateCode }),
        ...(dto.rateAmount !== undefined && { rateAmount: dto.rateAmount, totalAmount }),
        ...(dto.specialRequests !== undefined && { specialRequests: dto.specialRequests }),
        ...(dto.source && { source: dto.source }),
        ...(dto.arrivalTime !== undefined && { arrivalTime: dto.arrivalTime }),
      },
    });
  }

  async cancelReservation(propertyId: string, id: string, reason: string, userId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, propertyId },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');

    if (
      reservation.status === ReservationStatus.CHECKED_IN ||
      reservation.status === ReservationStatus.CHECKED_OUT
    ) {
      throw new BadRequestException(`Cannot cancel a ${reservation.status} reservation`);
    }

    if (reservation.status === ReservationStatus.CANCELLED) {
      throw new BadRequestException('Reservation is already cancelled');
    }

    return this.prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.CANCELLED,
        cancellationReason: reason,
        cancelledAt: new Date(),
      },
    });
  }

  async checkIn(propertyId: string, id: string, dto: CheckInDto, userId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, propertyId },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');

    if (reservation.status !== ReservationStatus.CONFIRMED) {
      throw new BadRequestException(
        `Cannot check in a reservation with status '${reservation.status}'`,
      );
    }

    // Verify the room belongs to this property and is available
    const room = await this.prisma.room.findFirst({
      where: { id: dto.roomId, propertyId },
    });
    if (!room) throw new NotFoundException('Room not found');

    if (room.isOOO) {
      throw new BadRequestException('Room is out of order and cannot be assigned');
    }

    if (
      room.status === RoomStatus.OCCUPIED_CLEAN ||
      room.status === RoomStatus.OCCUPIED_DIRTY
    ) {
      throw new ConflictException('Room is already occupied');
    }

    const actualCheckIn = dto.actualCheckIn ? new Date(dto.actualCheckIn) : new Date();
    const folioNumber = `FOL-${Date.now()}`;

    const checkIn = new Date(reservation.checkInDate);
    const checkOut = new Date(reservation.checkOutDate);
    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
    );
    const firstNightCharge = Number(reservation.rateAmount);
    const taxAmount = +(firstNightCharge * 0.12).toFixed(2);

    return this.prisma.$transaction(async (tx) => {
      // Update reservation
      const updatedReservation = await tx.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.CHECKED_IN,
          roomId: dto.roomId,
          actualCheckIn,
          checkedInById: userId,
        },
      });

      // Mark room as occupied and dirty
      await tx.room.update({
        where: { id: dto.roomId },
        data: { status: RoomStatus.OCCUPIED_DIRTY },
      });

      // Create folio
      const folio = await tx.folio.create({
        data: {
          propertyId,
          reservationId: id,
          guestProfileId: reservation.guestProfileId,
          folioNumber,
          status: FolioStatus.OPEN,
          totalCharges: firstNightCharge + taxAmount,
          totalPayments: 0,
          balance: firstNightCharge + taxAmount,
        },
      });

      // Post first night room charge
      await tx.folioItem.create({
        data: {
          folioId: folio.id,
          description: `Room charge — Night 1 of ${nights} (Check-in: ${actualCheckIn.toDateString()})`,
          quantity: 1,
          unitPrice: firstNightCharge,
          amount: firstNightCharge,
          taxAmount,
          referenceType: 'ROOM_CHARGE',
          referenceId: id,
          postedById: userId,
        },
      });

      return { reservation: updatedReservation, folio };
    });
  }

  async checkOut(propertyId: string, id: string, dto: CheckOutDto, userId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, propertyId },
      include: { folio: { include: { items: true } } },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');

    if (reservation.status !== ReservationStatus.CHECKED_IN) {
      throw new BadRequestException(
        `Cannot check out a reservation with status '${reservation.status}'`,
      );
    }

    const actualCheckOut = dto.actualCheckOut ? new Date(dto.actualCheckOut) : new Date();

    return this.prisma.$transaction(async (tx) => {
      // Update reservation
      const updatedReservation = await tx.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.CHECKED_OUT,
          actualCheckOut,
          checkedOutById: userId,
        },
      });

      // Mark room as dirty (requires housekeeper inspection before CLEAN)
      if (reservation.roomId) {
        await tx.room.update({
          where: { id: reservation.roomId },
          data: { status: RoomStatus.DIRTY },
        });
      }

      // Close folio and calculate final balance
      let closedFolio = null;
      if (reservation.folio) {
        const activeItems = reservation.folio.items.filter((i) => !i.isVoid);
        const totalCharges = activeItems.reduce(
          (sum, item) => sum + Number(item.amount) + Number(item.taxAmount),
          0,
        );
        const totalPayments = activeItems
          .filter((i) => Number(i.unitPrice) < 0)
          .reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0);
        const balance = +(totalCharges - totalPayments).toFixed(2);

        closedFolio = await tx.folio.update({
          where: { id: reservation.folio.id },
          data: {
            status: FolioStatus.CLOSED,
            totalCharges: +totalCharges.toFixed(2),
            totalPayments: +totalPayments.toFixed(2),
            balance,
            closedAt: actualCheckOut,
          },
        });
      }

      return { reservation: updatedReservation, folio: closedFolio };
    });
  }

  async noShow(propertyId: string, id: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, propertyId },
    });
    if (!reservation) throw new NotFoundException('Reservation not found');

    if (reservation.status !== ReservationStatus.CONFIRMED) {
      throw new BadRequestException(
        `Cannot mark as no-show a reservation with status '${reservation.status}'`,
      );
    }

    return this.prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.NO_SHOW,
        noShowAt: new Date(),
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  FOLIOS
  // ─────────────────────────────────────────────────────────

  async getFolio(propertyId: string, reservationId: string) {
    const folio = await this.prisma.folio.findFirst({
      where: { reservationId, propertyId },
      include: {
        items: { orderBy: { postedAt: 'asc' } },
        reservation: true,
        guestProfile: true,
      },
    });
    if (!folio) throw new NotFoundException('Folio not found for this reservation');
    return folio;
  }

  async addFolioItem(
    propertyId: string,
    folioId: string,
    dto: CreateFolioItemDto,
    userId: string,
  ) {
    const folio = await this.prisma.folio.findFirst({
      where: { id: folioId, propertyId },
      include: { items: { where: { isVoid: false } } },
    });
    if (!folio) throw new NotFoundException('Folio not found');
    if (folio.status === FolioStatus.CLOSED) {
      throw new BadRequestException('Cannot add items to a closed folio');
    }

    const amount = +(dto.quantity * dto.unitPrice).toFixed(2);
    const taxAmount = dto.taxAmount ?? 0;

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.folioItem.create({
        data: {
          folioId,
          description: dto.description,
          quantity: dto.quantity,
          unitPrice: dto.unitPrice,
          amount,
          taxAmount,
          referenceType: dto.referenceType,
          referenceId: dto.referenceId,
          postedById: userId,
        },
      });

      // Recalculate folio totals
      const allItems = [...folio.items, item];
      const totalCharges = allItems.reduce(
        (sum, i) => sum + Number(i.amount) + Number(i.taxAmount ?? 0),
        0,
      );
      // Payments are represented as negative unitPrice items
      const totalPayments = allItems
        .filter((i) => Number(i.unitPrice) < 0)
        .reduce((sum, i) => sum + Math.abs(Number(i.amount)), 0);
      const balance = +(totalCharges - totalPayments).toFixed(2);

      await tx.folio.update({
        where: { id: folioId },
        data: {
          totalCharges: +totalCharges.toFixed(2),
          totalPayments: +totalPayments.toFixed(2),
          balance,
        },
      });

      return item;
    });
  }

  async voidFolioItem(propertyId: string, itemId: string, reason: string, userId: string) {
    const item = await this.prisma.folioItem.findFirst({
      where: { id: itemId, folio: { propertyId } },
      include: { folio: { include: { items: { where: { isVoid: false } } } } },
    });
    if (!item) throw new NotFoundException('Folio item not found');
    if (item.isVoid) throw new BadRequestException('Item is already voided');
    if (item.folio.status === FolioStatus.CLOSED) {
      throw new BadRequestException('Cannot void items on a closed folio');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.folioItem.update({
        where: { id: itemId },
        data: { isVoid: true, voidReason: reason, voidedAt: new Date() },
      });

      // Recalculate using remaining active items (exclude the voided one)
      const remainingItems = item.folio.items.filter((i) => i.id !== itemId);
      const totalCharges = remainingItems.reduce(
        (sum, i) => sum + Number(i.amount) + Number(i.taxAmount ?? 0),
        0,
      );
      const totalPayments = remainingItems
        .filter((i) => Number(i.unitPrice) < 0)
        .reduce((sum, i) => sum + Math.abs(Number(i.amount)), 0);
      const balance = +(totalCharges - totalPayments).toFixed(2);

      return tx.folio.update({
        where: { id: item.folioId },
        data: {
          totalCharges: +totalCharges.toFixed(2),
          totalPayments: +totalPayments.toFixed(2),
          balance,
        },
      });
    });
  }

  async postPayment(
    propertyId: string,
    folioId: string,
    amount: number,
    method: string,
    userId: string,
  ) {
    const folio = await this.prisma.folio.findFirst({
      where: { id: folioId, propertyId },
      include: { items: { where: { isVoid: false } } },
    });
    if (!folio) throw new NotFoundException('Folio not found');
    if (folio.status === FolioStatus.CLOSED) {
      throw new BadRequestException('Cannot post payment to a closed folio');
    }

    // Payment is represented as a negative-amount line item
    const paymentAmount = Math.abs(amount);

    return this.prisma.$transaction(async (tx) => {
      const paymentItem = await tx.folioItem.create({
        data: {
          folioId,
          description: `Payment received — ${method}`,
          quantity: 1,
          unitPrice: -paymentAmount,
          amount: -paymentAmount,
          taxAmount: 0,
          referenceType: 'PAYMENT',
          referenceId: method,
          postedById: userId,
        },
      });

      // Recalculate totals
      const allItems = [...folio.items, paymentItem];
      const totalCharges = allItems
        .filter((i) => Number(i.unitPrice) >= 0)
        .reduce((sum, i) => sum + Number(i.amount) + Number(i.taxAmount ?? 0), 0);
      const totalPayments = allItems
        .filter((i) => Number(i.unitPrice) < 0)
        .reduce((sum, i) => sum + Math.abs(Number(i.amount)), 0);
      const balance = +(totalCharges - totalPayments).toFixed(2);

      await tx.folio.update({
        where: { id: folioId },
        data: {
          totalCharges: +totalCharges.toFixed(2),
          totalPayments: +totalPayments.toFixed(2),
          balance,
        },
      });

      return { paymentItem, newBalance: balance };
    });
  }

  async closeFolio(propertyId: string, folioId: string, userId: string) {
    const folio = await this.prisma.folio.findFirst({
      where: { id: folioId, propertyId },
      include: { items: { where: { isVoid: false } } },
    });
    if (!folio) throw new NotFoundException('Folio not found');
    if (folio.status === FolioStatus.CLOSED) {
      throw new BadRequestException('Folio is already closed');
    }

    const totalCharges = folio.items
      .filter((i) => Number(i.unitPrice) >= 0)
      .reduce((sum, i) => sum + Number(i.amount) + Number(i.taxAmount ?? 0), 0);
    const totalPayments = folio.items
      .filter((i) => Number(i.unitPrice) < 0)
      .reduce((sum, i) => sum + Math.abs(Number(i.amount)), 0);
    const balance = +(totalCharges - totalPayments).toFixed(2);

    if (balance > 0) {
      throw new BadRequestException(
        `Folio has an outstanding balance of ${balance}. Please post payment before closing.`,
      );
    }

    return this.prisma.folio.update({
      where: { id: folioId },
      data: {
        status: FolioStatus.CLOSED,
        totalCharges: +totalCharges.toFixed(2),
        totalPayments: +totalPayments.toFixed(2),
        balance,
        closedAt: new Date(),
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  NIGHT AUDIT
  // ─────────────────────────────────────────────────────────

  async runNightAudit(propertyId: string, userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Prevent running audit twice for the same date
    const existing = await this.prisma.nightAudit.findUnique({
      where: { propertyId_auditDate: { propertyId, auditDate: today } },
    });
    if (existing) {
      throw new ConflictException(`Night audit for ${today.toDateString()} has already been run`);
    }

    // Count rooms
    const totalRooms = await this.prisma.room.count({ where: { propertyId, isOOO: false } });

    const occupiedRooms = await this.prisma.room.count({
      where: {
        propertyId,
        status: { in: [RoomStatus.OCCUPIED_CLEAN, RoomStatus.OCCUPIED_DIRTY] },
      },
    });

    const occupancyPct = totalRooms > 0 ? +((occupiedRooms / totalRooms) * 100).toFixed(2) : 0;

    // Get all checked-in reservations
    const checkedInReservations = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        status: ReservationStatus.CHECKED_IN,
      },
      include: { folio: true },
    });

    // Average Daily Rate from current in-house reservations
    const totalRoomRevenue = checkedInReservations.reduce(
      (sum, r) => sum + Number(r.rateAmount),
      0,
    );
    const adr = occupiedRooms > 0 ? +(totalRoomRevenue / occupiedRooms).toFixed(2) : 0;
    const revpar = totalRooms > 0 ? +(totalRoomRevenue / totalRooms).toFixed(2) : 0;

    // Tally all folio charges posted today
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    const todayFolioItems = await this.prisma.folioItem.findMany({
      where: {
        folio: { propertyId },
        isVoid: false,
        postedAt: { gte: today, lte: todayEnd },
      },
    });

    const totalRevenue = todayFolioItems
      .filter((i) => Number(i.unitPrice) >= 0)
      .reduce((sum, i) => sum + Number(i.amount) + Number(i.taxAmount ?? 0), 0);

    const fbRevenue = todayFolioItems
      .filter((i) => i.referenceType === 'POS_CHARGE' && Number(i.unitPrice) >= 0)
      .reduce((sum, i) => sum + Number(i.amount), 0);

    const roomChargeRevenue = todayFolioItems
      .filter((i) => i.referenceType === 'ROOM_CHARGE' && Number(i.unitPrice) >= 0)
      .reduce((sum, i) => sum + Number(i.amount), 0);

    const otherRevenue = +(totalRevenue - roomChargeRevenue - fbRevenue).toFixed(2);

    // Auto-post nightly room charge to all currently checked-in folios
    const roomChargePostings = checkedInReservations
      .filter((r) => r.folio && r.folio.status === FolioStatus.OPEN)
      .map((r) => {
        const nightCharge = Number(r.rateAmount);
        const tax = +(nightCharge * 0.12).toFixed(2);
        return this.prisma.folioItem.create({
          data: {
            folioId: r.folio!.id,
            description: `Nightly room charge — ${today.toDateString()} (Night Audit)`,
            quantity: 1,
            unitPrice: nightCharge,
            amount: nightCharge,
            taxAmount: tax,
            referenceType: 'ROOM_CHARGE',
            referenceId: r.id,
            postedById: userId,
          },
        });
      });

    // Execute room charge postings and update folio balances
    await this.prisma.$transaction(async (tx) => {
      for (const reservation of checkedInReservations) {
        if (!reservation.folio || reservation.folio.status !== FolioStatus.OPEN) continue;

        const nightCharge = Number(reservation.rateAmount);
        const tax = +(nightCharge * 0.12).toFixed(2);

        await tx.folioItem.create({
          data: {
            folioId: reservation.folio.id,
            description: `Nightly room charge — ${today.toDateString()} (Night Audit)`,
            quantity: 1,
            unitPrice: nightCharge,
            amount: nightCharge,
            taxAmount: tax,
            referenceType: 'ROOM_CHARGE',
            referenceId: reservation.id,
            postedById: userId,
          },
        });

        await tx.folio.update({
          where: { id: reservation.folio.id },
          data: {
            totalCharges: { increment: +(nightCharge + tax).toFixed(2) },
            balance: { increment: +(nightCharge + tax).toFixed(2) },
          },
        });
      }
    });

    // Create night audit record
    return this.prisma.nightAudit.create({
      data: {
        propertyId,
        auditDate: today,
        totalRooms,
        occupiedRooms,
        occupancyPct,
        adr,
        revpar,
        totalRevenue: +totalRevenue.toFixed(2),
        roomRevenue: +roomChargeRevenue.toFixed(2),
        fbRevenue: +fbRevenue.toFixed(2),
        otherRevenue,
        runById: userId,
        completedAt: new Date(),
      },
    });
  }

  async getNightAudit(propertyId: string, auditDate: string) {
    const date = new Date(auditDate);
    date.setHours(0, 0, 0, 0);

    const audit = await this.prisma.nightAudit.findUnique({
      where: { propertyId_auditDate: { propertyId, auditDate: date } },
    });
    if (!audit) throw new NotFoundException(`No night audit found for ${auditDate}`);
    return audit;
  }

  async listNightAudits(propertyId: string, skip: number, take: number) {
    const [audits, total] = await Promise.all([
      this.prisma.nightAudit.findMany({
        where: { propertyId },
        orderBy: { auditDate: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.nightAudit.count({ where: { propertyId } }),
    ]);
    return { audits, total, skip, take };
  }
}
