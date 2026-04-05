import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  ReservationStatus,
  ServiceRequestStatus,
  MessageStatus,
} from '@prisma/client';
import { GuestCheckinRequestDto } from './dto/guest-checkin-request.dto';
import { ServiceRequestDto } from './dto/service-request.dto';
import { GuestFeedbackDto } from './dto/guest-feedback.dto';
import { GuestMessageDto } from './dto/guest-message.dto';

@Injectable()
export class GuestAppService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────
  //  SELF CHECK-IN
  // ─────────────────────────────────────────────────────────

  async selfCheckIn(propertyId: string, dto: GuestCheckinRequestDto) {
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        propertyId,
        confirmationNo: dto.confirmationNo,
        status: ReservationStatus.CONFIRMED,
      },
      include: { guestProfile: true, room: { include: { roomType: true } } },
    });

    if (!reservation) {
      throw new NotFoundException(
        'No confirmed reservation found for this confirmation number',
      );
    }

    // Verify last name matches (identity check)
    if (
      reservation.guestProfile &&
      reservation.guestProfile.lastName.toLowerCase() !== dto.lastName.toLowerCase()
    ) {
      throw new BadRequestException(
        'Last name does not match the reservation record',
      );
    }

    const today = new Date();
    const checkInDate = new Date(reservation.checkInDate);
    checkInDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    if (today < checkInDate) {
      throw new BadRequestException(
        `Check-in is not available until ${reservation.checkInDate.toDateString()}`,
      );
    }

    return {
      message: 'Self check-in request received. A staff member will complete your check-in shortly.',
      reservation: {
        id: reservation.id,
        confirmationNo: reservation.confirmationNo,
        checkInDate: reservation.checkInDate,
        checkOutDate: reservation.checkOutDate,
        guestName: reservation.guestProfile
          ? `${reservation.guestProfile.firstName} ${reservation.guestProfile.lastName}`
          : null,
      },
    };
  }

  async requestCheckOut(propertyId: string, guestProfileId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: {
        propertyId,
        guestProfileId,
        status: ReservationStatus.CHECKED_IN,
      },
      include: { folio: true },
    });

    if (!reservation) {
      throw new NotFoundException('No active stay found for this guest');
    }

    return {
      message: 'Check-out request received. A staff member will finalise your bill shortly.',
      reservationId: reservation.id,
      currentBalance: reservation.folio?.balance ?? 0,
    };
  }

  // ─────────────────────────────────────────────────────────
  //  SERVICE REQUESTS
  // ─────────────────────────────────────────────────────────

  async createServiceRequest(
    propertyId: string,
    guestProfileId: string,
    dto: ServiceRequestDto,
  ) {
    // Verify guest profile belongs to property
    const guest = await this.prisma.guestProfile.findFirst({
      where: { id: guestProfileId, propertyId },
    });
    if (!guest) throw new NotFoundException('Guest profile not found');

    return this.prisma.serviceRequest.create({
      data: {
        propertyId,
        guestProfileId,
        reservationId: dto.reservationId,
        category: dto.category,
        title: dto.title,
        description: dto.description,
        status: ServiceRequestStatus.OPEN,
        priority: dto.priority ?? 'normal',
      },
    });
  }

  async getServiceRequest(propertyId: string, id: string, guestProfileId: string) {
    const req = await this.prisma.serviceRequest.findFirst({
      where: { id, propertyId, guestProfileId },
    });
    if (!req) throw new NotFoundException('Service request not found');
    return req;
  }

  async listServiceRequests(propertyId: string, guestProfileId: string) {
    return this.prisma.serviceRequest.findMany({
      where: { propertyId, guestProfileId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  CHAT MESSAGES
  // ─────────────────────────────────────────────────────────

  async sendMessage(
    propertyId: string,
    guestProfileId: string,
    dto: GuestMessageDto,
  ) {
    const guest = await this.prisma.guestProfile.findFirst({
      where: { id: guestProfileId, propertyId },
    });
    if (!guest) throw new NotFoundException('Guest profile not found');

    return this.prisma.chatMessage.create({
      data: {
        propertyId,
        guestProfileId,
        senderType: 'guest',
        senderId: guestProfileId,
        content: dto.content,
        status: MessageStatus.SENT,
      },
    });
  }

  async getChatHistory(propertyId: string, guestProfileId: string, skip = 0, take = 50) {
    const [messages, total] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { propertyId, guestProfileId },
        orderBy: { createdAt: 'asc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.chatMessage.count({ where: { propertyId, guestProfileId } }),
    ]);

    return { messages, total, skip, take };
  }

  async replyToGuest(
    propertyId: string,
    guestProfileId: string,
    content: string,
    staffId: string,
  ) {
    const guest = await this.prisma.guestProfile.findFirst({
      where: { id: guestProfileId, propertyId },
    });
    if (!guest) throw new NotFoundException('Guest profile not found');

    return this.prisma.chatMessage.create({
      data: {
        propertyId,
        guestProfileId,
        senderType: 'staff',
        senderId: staffId,
        content,
        status: MessageStatus.SENT,
      },
    });
  }

  async markMessagesRead(propertyId: string, guestProfileId: string) {
    await this.prisma.chatMessage.updateMany({
      where: {
        propertyId,
        guestProfileId,
        senderType: 'guest',
        isRead: false,
      },
      data: { isRead: true, readAt: new Date(), status: MessageStatus.READ },
    });
    return { message: 'Messages marked as read' };
  }

  // ─────────────────────────────────────────────────────────
  //  FEEDBACK
  // ─────────────────────────────────────────────────────────

  async submitFeedback(
    propertyId: string,
    guestProfileId: string,
    dto: GuestFeedbackDto,
  ) {
    const guest = await this.prisma.guestProfile.findFirst({
      where: { id: guestProfileId, propertyId },
    });
    if (!guest) throw new NotFoundException('Guest profile not found');

    // Prevent duplicate feedback per reservation
    if (dto.reservationId) {
      const existing = await this.prisma.guestFeedback.findFirst({
        where: { propertyId, guestProfileId, reservationId: dto.reservationId },
      });
      if (existing) {
        throw new BadRequestException('Feedback already submitted for this reservation');
      }
    }

    return this.prisma.guestFeedback.create({
      data: {
        propertyId,
        guestProfileId,
        reservationId: dto.reservationId,
        overallRating: dto.overallRating,
        cleanlinessRating: dto.cleanlinessRating,
        serviceRating: dto.serviceRating,
        locationRating: dto.locationRating,
        valueRating: dto.valueRating,
        facilityRating: dto.facilityRating,
        comments: dto.comments,
        isPublic: dto.isPublic ?? false,
      },
    });
  }

  async getFeedback(propertyId: string, guestProfileId: string) {
    return this.prisma.guestFeedback.findMany({
      where: { propertyId, guestProfileId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPropertyFeedback(
    propertyId: string,
    params: { skip?: number; take?: number },
  ) {
    const { skip = 0, take = 20 } = params;

    const [feedback, total] = await Promise.all([
      this.prisma.guestFeedback.findMany({
        where: { propertyId },
        include: { guestProfile: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.guestFeedback.count({ where: { propertyId } }),
    ]);

    return { feedback, total, skip, take };
  }
}
