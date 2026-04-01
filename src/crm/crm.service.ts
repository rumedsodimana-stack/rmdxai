import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { LoyaltyTier } from '@prisma/client';
import { CreateGuestProfileDto } from './dto/create-guest-profile.dto';
import { UpdateGuestProfileDto } from './dto/update-guest-profile.dto';
import { AddPreferenceDto } from './dto/add-preference.dto';

// ─────────────────────────────────────────────────────────
//  LOYALTY TIER THRESHOLDS
// ─────────────────────────────────────────────────────────
function deriveLoyaltyTier(totalStays: number): LoyaltyTier {
  if (totalStays >= 50) return LoyaltyTier.PLATINUM;
  if (totalStays >= 20) return LoyaltyTier.GOLD;
  if (totalStays >= 5) return LoyaltyTier.SILVER;
  return LoyaltyTier.BRONZE;
}

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────
  //  GUEST PROFILES — CRUD
  // ─────────────────────────────────────────────────────────

  async createGuestProfile(propertyId: string, dto: CreateGuestProfileDto) {
    // Duplicate detection: same email OR same passport within this property
    if (dto.email) {
      const emailMatch = await this.prisma.guestProfile.findFirst({
        where: { propertyId, email: dto.email },
      });
      if (emailMatch) {
        throw new ConflictException(
          `A guest profile with email '${dto.email}' already exists (id: ${emailMatch.id}). Use merge if this is the same guest.`,
        );
      }
    }

    if (dto.passportNo) {
      const passportMatch = await this.prisma.guestProfile.findFirst({
        where: { propertyId, passportNo: dto.passportNo },
      });
      if (passportMatch) {
        throw new ConflictException(
          `A guest profile with passport '${dto.passportNo}' already exists (id: ${passportMatch.id}). Use merge if this is the same guest.`,
        );
      }
    }

    return this.prisma.guestProfile.create({
      data: {
        propertyId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        nationality: dto.nationality,
        passportNo: dto.passportNo,
        passportExpiry: dto.passportExpiry ? new Date(dto.passportExpiry) : undefined,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        address: dto.address,
        city: dto.city,
        country: dto.country,
        language: dto.language ?? 'en',
        isVip: dto.isVip ?? false,
        vipReason: dto.isVip ? dto.vipReason : null,
        loyaltyTier: LoyaltyTier.BRONZE,
      },
    });
  }

  async listGuestProfiles(
    propertyId: string,
    params: { skip?: number; take?: number },
  ) {
    const { skip = 0, take = 20 } = params;

    const [guests, total] = await Promise.all([
      this.prisma.guestProfile.findMany({
        where: { propertyId },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: Number(skip),
        take: Number(take),
        include: {
          _count: { select: { reservations: true, preferences: true, guestNotes: true } },
        },
      }),
      this.prisma.guestProfile.count({ where: { propertyId } }),
    ]);

    return { guests, total, skip, take };
  }

  async getGuestProfile(propertyId: string, id: string) {
    const guest = await this.prisma.guestProfile.findFirst({
      where: { id, propertyId },
      include: {
        preferences: { orderBy: { category: 'asc' } },
        guestNotes: { orderBy: { createdAt: 'desc' }, take: 10 },
        reservations: {
          orderBy: { checkInDate: 'desc' },
          take: 10,
          include: { room: { include: { roomType: true } } },
        },
        loyalty: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!guest) throw new NotFoundException('Guest profile not found');
    return guest;
  }

  async updateGuestProfile(propertyId: string, id: string, dto: UpdateGuestProfileDto) {
    const guest = await this.prisma.guestProfile.findFirst({ where: { id, propertyId } });
    if (!guest) throw new NotFoundException('Guest profile not found');

    // Guard against email collision on update
    if (dto.email && dto.email !== guest.email) {
      const collision = await this.prisma.guestProfile.findFirst({
        where: { propertyId, email: dto.email, id: { not: id } },
      });
      if (collision) {
        throw new ConflictException(
          `Email '${dto.email}' belongs to another guest profile (id: ${collision.id})`,
        );
      }
    }

    return this.prisma.guestProfile.update({
      where: { id },
      data: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.nationality !== undefined && { nationality: dto.nationality }),
        ...(dto.passportNo !== undefined && { passportNo: dto.passportNo }),
        ...(dto.passportExpiry !== undefined && {
          passportExpiry: dto.passportExpiry ? new Date(dto.passportExpiry) : null,
        }),
        ...(dto.dateOfBirth !== undefined && {
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.language && { language: dto.language }),
      },
    });
  }

  async deleteGuestProfile(propertyId: string, id: string) {
    const guest = await this.prisma.guestProfile.findFirst({ where: { id, propertyId } });
    if (!guest) throw new NotFoundException('Guest profile not found');

    // Cannot delete a profile with active or future reservations
    const activeReservation = await this.prisma.reservation.findFirst({
      where: {
        guestProfileId: id,
        status: { in: ['CONFIRMED', 'CHECKED_IN'] as any },
      },
    });
    if (activeReservation) {
      throw new BadRequestException(
        'Cannot delete a guest profile with active or future reservations',
      );
    }

    await this.prisma.guestProfile.delete({ where: { id } });
    return { deleted: true, id };
  }

  // ─────────────────────────────────────────────────────────
  //  SEARCH
  // ─────────────────────────────────────────────────────────

  async searchGuests(propertyId: string, query: string, take = 20) {
    if (!query || query.trim().length < 2) {
      throw new BadRequestException('Search query must be at least 2 characters');
    }

    const term = query.trim();

    return this.prisma.guestProfile.findMany({
      where: {
        propertyId,
        OR: [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term, mode: 'insensitive' } },
          { passportNo: { contains: term, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: Number(take),
    });
  }

  // ─────────────────────────────────────────────────────────
  //  MERGE DETECTION
  // ─────────────────────────────────────────────────────────

  async findMergeCandidates(propertyId: string, id: string) {
    const source = await this.prisma.guestProfile.findFirst({ where: { id, propertyId } });
    if (!source) throw new NotFoundException('Guest profile not found');

    const candidates = await this.prisma.guestProfile.findMany({
      where: {
        propertyId,
        id: { not: id },
        OR: [
          ...(source.email ? [{ email: source.email }] : []),
          ...(source.phone ? [{ phone: source.phone }] : []),
          ...(source.passportNo ? [{ passportNo: source.passportNo }] : []),
          {
            firstName: { equals: source.firstName, mode: 'insensitive' as any },
            lastName: { equals: source.lastName, mode: 'insensitive' as any },
          },
        ],
      },
    });

    return { source, candidates };
  }

  async mergeGuestProfiles(propertyId: string, survivorId: string, duplicateId: string, userId: string) {
    if (survivorId === duplicateId) {
      throw new BadRequestException('Cannot merge a profile with itself');
    }

    const [survivor, duplicate] = await Promise.all([
      this.prisma.guestProfile.findFirst({ where: { id: survivorId, propertyId } }),
      this.prisma.guestProfile.findFirst({ where: { id: duplicateId, propertyId } }),
    ]);

    if (!survivor) throw new NotFoundException('Survivor guest profile not found');
    if (!duplicate) throw new NotFoundException('Duplicate guest profile not found');

    return this.prisma.$transaction(async (tx) => {
      // Re-point all reservations and folios to survivor
      await tx.reservation.updateMany({
        where: { guestProfileId: duplicateId },
        data: { guestProfileId: survivorId },
      });
      await tx.folio.updateMany({
        where: { guestProfileId: duplicateId },
        data: { guestProfileId: survivorId },
      });

      // Carry over loyalty points and stay count
      const totalStays = survivor.totalStays + duplicate.totalStays;
      const totalSpend = Number(survivor.totalSpend) + Number(duplicate.totalSpend);
      const loyaltyPoints = survivor.loyaltyPoints + duplicate.loyaltyPoints;
      const newTier = deriveLoyaltyTier(totalStays);

      const updatedSurvivor = await tx.guestProfile.update({
        where: { id: survivorId },
        data: {
          totalStays,
          totalSpend,
          loyaltyPoints,
          loyaltyTier: newTier,
          // Fill in missing fields from duplicate if survivor lacks them
          email: survivor.email ?? duplicate.email,
          phone: survivor.phone ?? duplicate.phone,
          passportNo: survivor.passportNo ?? duplicate.passportNo,
          nationality: survivor.nationality ?? duplicate.nationality,
          notes: survivor.notes
            ? `${survivor.notes} | Merged duplicate ${duplicateId} by ${userId}`
            : `Merged duplicate ${duplicateId} by ${userId}`,
        },
      });

      // Move preferences
      await tx.guestPreference.updateMany({
        where: { guestProfileId: duplicateId },
        data: { guestProfileId: survivorId },
      });

      // Move notes
      await tx.guestNote.updateMany({
        where: { guestProfileId: duplicateId },
        data: { guestProfileId: survivorId },
      });

      // Delete duplicate
      await tx.guestProfile.delete({ where: { id: duplicateId } });

      return { survivor: updatedSurvivor, mergedFrom: duplicateId };
    });
  }

  // ─────────────────────────────────────────────────────────
  //  STAY HISTORY
  // ─────────────────────────────────────────────────────────

  async getStayHistory(propertyId: string, id: string, skip = 0, take = 20) {
    const guest = await this.prisma.guestProfile.findFirst({ where: { id, propertyId } });
    if (!guest) throw new NotFoundException('Guest profile not found');

    const [reservations, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where: { guestProfileId: id, propertyId },
        orderBy: { checkInDate: 'desc' },
        skip: Number(skip),
        take: Number(take),
        include: {
          room: { include: { roomType: true } },
          folio: { select: { totalCharges: true, totalPayments: true, balance: true, status: true } },
        },
      }),
      this.prisma.reservation.count({ where: { guestProfileId: id, propertyId } }),
    ]);

    return { reservations, total, skip, take };
  }

  async recordStayAndUpdateLoyalty(
    propertyId: string,
    guestId: string,
    reservationId: string,
    pointsEarned: number,
    userId: string,
  ) {
    const guest = await this.prisma.guestProfile.findFirst({ where: { id: guestId, propertyId } });
    if (!guest) throw new NotFoundException('Guest profile not found');

    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, propertyId, guestProfileId: guestId },
    });
    if (!reservation) throw new NotFoundException('Reservation not found for this guest');

    const newTotalStays = guest.totalStays + 1;
    const newPoints = guest.loyaltyPoints + (pointsEarned ?? 0);
    const newTier = deriveLoyaltyTier(newTotalStays);
    const newSpend = Number(guest.totalSpend) + Number(reservation.totalAmount);

    return this.prisma.$transaction(async (tx) => {
      const updatedGuest = await tx.guestProfile.update({
        where: { id: guestId },
        data: {
          totalStays: newTotalStays,
          totalSpend: newSpend,
          loyaltyPoints: newPoints,
          loyaltyTier: newTier,
        },
      });

      const loyaltyTx = await tx.loyaltyTransaction.create({
        data: {
          guestProfileId: guestId,
          type: 'earn',
          points: pointsEarned ?? 0,
          balanceAfter: newPoints,
          description: `Stay completed — reservation ${reservationId}`,
          referenceType: 'reservation',
          referenceId: reservationId,
        },
      });

      return { guest: updatedGuest, loyaltyTransaction: loyaltyTx };
    });
  }

  // ─────────────────────────────────────────────────────────
  //  PREFERENCES
  // ─────────────────────────────────────────────────────────

  async addPreference(propertyId: string, guestId: string, dto: AddPreferenceDto) {
    const guest = await this.prisma.guestProfile.findFirst({ where: { id: guestId, propertyId } });
    if (!guest) throw new NotFoundException('Guest profile not found');

    return this.prisma.guestPreference.create({
      data: {
        guestProfileId: guestId,
        category: dto.category,
        preference: dto.preference,
        notes: dto.notes,
      },
    });
  }

  async getPreferences(propertyId: string, guestId: string) {
    const guest = await this.prisma.guestProfile.findFirst({ where: { id: guestId, propertyId } });
    if (!guest) throw new NotFoundException('Guest profile not found');

    return this.prisma.guestPreference.findMany({
      where: { guestProfileId: guestId },
      orderBy: [{ category: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async deletePreference(propertyId: string, guestId: string, preferenceId: string) {
    const guest = await this.prisma.guestProfile.findFirst({ where: { id: guestId, propertyId } });
    if (!guest) throw new NotFoundException('Guest profile not found');

    const pref = await this.prisma.guestPreference.findFirst({
      where: { id: preferenceId, guestProfileId: guestId },
    });
    if (!pref) throw new NotFoundException('Preference not found');

    await this.prisma.guestPreference.delete({ where: { id: preferenceId } });
    return { deleted: true, id: preferenceId };
  }

  // ─────────────────────────────────────────────────────────
  //  VIP FLAG
  // ─────────────────────────────────────────────────────────

  async setVipFlag(
    propertyId: string,
    id: string,
    isVip: boolean,
    reason: string | undefined,
    userId: string,
  ) {
    const guest = await this.prisma.guestProfile.findFirst({ where: { id, propertyId } });
    if (!guest) throw new NotFoundException('Guest profile not found');

    if (isVip && !reason) {
      throw new BadRequestException('A reason is required when setting VIP status');
    }

    return this.prisma.guestProfile.update({
      where: { id },
      data: {
        isVip,
        vipReason: isVip ? reason : null,
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  NOTES
  // ─────────────────────────────────────────────────────────

  async addNote(
    propertyId: string,
    guestId: string,
    content: string,
    type: string,
    isPrivate: boolean,
    authorId: string,
  ) {
    const guest = await this.prisma.guestProfile.findFirst({ where: { id: guestId, propertyId } });
    if (!guest) throw new NotFoundException('Guest profile not found');

    if (!content || content.trim().length === 0) {
      throw new BadRequestException('Note content cannot be empty');
    }

    return this.prisma.guestNote.create({
      data: {
        guestProfileId: guestId,
        authorId,
        type: type ?? 'general',
        content: content.trim(),
        isPrivate: isPrivate ?? false,
      },
    });
  }

  async getNotes(propertyId: string, guestId: string, includePrivate = false) {
    const guest = await this.prisma.guestProfile.findFirst({ where: { id: guestId, propertyId } });
    if (!guest) throw new NotFoundException('Guest profile not found');

    return this.prisma.guestNote.findMany({
      where: {
        guestProfileId: guestId,
        ...(includePrivate ? {} : { isPrivate: false }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  LOYALTY TRANSACTIONS
  // ─────────────────────────────────────────────────────────

  async getLoyaltyTransactions(propertyId: string, guestId: string, skip = 0, take = 20) {
    const guest = await this.prisma.guestProfile.findFirst({ where: { id: guestId, propertyId } });
    if (!guest) throw new NotFoundException('Guest profile not found');

    const [transactions, total] = await Promise.all([
      this.prisma.loyaltyTransaction.findMany({
        where: { guestProfileId: guestId },
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.loyaltyTransaction.count({ where: { guestProfileId: guestId } }),
    ]);

    return { transactions, total, skip, take };
  }
}
