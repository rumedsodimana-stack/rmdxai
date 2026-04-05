import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateGuestProfileDto } from './dto/create-guest-profile.dto';
import { UpdateGuestProfileDto } from './dto/update-guest-profile.dto';
import { CreateGuestNoteDto } from './dto/create-guest-note.dto';
import { CreateGuestPreferenceDto } from './dto/create-guest-preference.dto';
import { AdjustLoyaltyPointsDto } from './dto/adjust-loyalty-points.dto';
import { BlacklistGuestDto } from './dto/blacklist-guest.dto';
import { LoyaltyTier } from '@prisma/client';

// Loyalty tier thresholds (points)
const TIER_THRESHOLDS: { tier: LoyaltyTier; min: number }[] = [
  { tier: LoyaltyTier.DIAMOND, min: 10000 },
  { tier: LoyaltyTier.PLATINUM, min: 5000 },
  { tier: LoyaltyTier.GOLD, min: 2000 },
  { tier: LoyaltyTier.SILVER, min: 500 },
  { tier: LoyaltyTier.BRONZE, min: 0 },
];

function resolveTier(points: number): LoyaltyTier {
  for (const { tier, min } of TIER_THRESHOLDS) {
    if (points >= min) return tier;
  }
  return LoyaltyTier.BRONZE;
}

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────
  //  Guest Profiles
  // ─────────────────────────────────────────────────────────────────

  async createGuestProfile(propertyId: string, dto: CreateGuestProfileDto) {
    if (dto.email) {
      const existing = await this.prisma.guestProfile.findFirst({
        where: { propertyId, email: dto.email },
      });
      if (existing) {
        throw new ConflictException(
          `A guest profile with email '${dto.email}' already exists for this property`,
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
        loyaltyPoints: 0,
        loyaltyTier: LoyaltyTier.BRONZE,
        totalStays: 0,
        totalSpend: 0,
      },
    });
  }

  async searchGuestProfiles(
    propertyId: string,
    query: {
      name?: string;
      email?: string;
      phone?: string;
      loyaltyTier?: LoyaltyTier;
      isVip?: boolean;
      skip?: number;
      take?: number;
    },
  ) {
    const { name, email, phone, loyaltyTier, isVip, skip = 0, take = 20 } = query;

    const where: Parameters<typeof this.prisma.guestProfile.findMany>[0]['where'] = {
      propertyId,
      ...(loyaltyTier ? { loyaltyTier } : {}),
      ...(isVip !== undefined ? { isVip } : {}),
    };

    if (name || email || phone) {
      where.OR = [];
      if (name) {
        const nameParts = name.trim().split(/\s+/);
        where.OR.push(
          { firstName: { contains: name, mode: 'insensitive' } },
          { lastName: { contains: name, mode: 'insensitive' } },
        );
        if (nameParts.length >= 2) {
          where.OR.push({
            AND: [
              { firstName: { contains: nameParts[0], mode: 'insensitive' } },
              { lastName: { contains: nameParts[nameParts.length - 1], mode: 'insensitive' } },
            ],
          });
        }
      }
      if (email) where.OR.push({ email: { contains: email, mode: 'insensitive' } });
      if (phone) where.OR.push({ phone: { contains: phone } });
    }

    const [items, total] = await Promise.all([
      this.prisma.guestProfile.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.guestProfile.count({ where }),
    ]);

    return { items, total, skip, take };
  }

  async getGuestProfile(propertyId: string, id: string) {
    const profile = await this.prisma.guestProfile.findFirst({
      where: { id, propertyId },
      include: {
        preferences: { orderBy: { createdAt: 'desc' } },
        guestNotes: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        reservations: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            confirmationNo: true,
            status: true,
            checkInDate: true,
            checkOutDate: true,
            rateAmount: true,
            totalAmount: true,
            source: true,
            createdAt: true,
          },
        },
        loyalty: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { balanceAfter: true },
        },
      },
    });

    if (!profile) throw new NotFoundException(`Guest profile ${id} not found`);
    return profile;
  }

  async updateGuestProfile(propertyId: string, id: string, dto: UpdateGuestProfileDto) {
    const profile = await this.prisma.guestProfile.findFirst({ where: { id, propertyId } });
    if (!profile) throw new NotFoundException(`Guest profile ${id} not found`);

    if (dto.email && dto.email !== profile.email) {
      const duplicate = await this.prisma.guestProfile.findFirst({
        where: { propertyId, email: dto.email, NOT: { id } },
      });
      if (duplicate) {
        throw new ConflictException(`Email '${dto.email}' is already used by another guest profile`);
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
        ...(dto.isVip !== undefined && { isVip: dto.isVip }),
        ...(dto.vipReason !== undefined && { vipReason: dto.vipReason }),
      },
    });
  }

  async mergeGuestProfiles(propertyId: string, sourceId: string, targetId: string) {
    const [source, target] = await Promise.all([
      this.prisma.guestProfile.findFirst({ where: { id: sourceId, propertyId } }),
      this.prisma.guestProfile.findFirst({ where: { id: targetId, propertyId } }),
    ]);

    if (!source) throw new NotFoundException(`Source guest profile ${sourceId} not found`);
    if (!target) throw new NotFoundException(`Target guest profile ${targetId} not found`);
    if (sourceId === targetId) throw new BadRequestException('Source and target profiles must be different');

    return this.prisma.$transaction(async (tx) => {
      // Re-assign reservations, preferences, notes to target
      await Promise.all([
        tx.reservation.updateMany({
          where: { guestProfileId: sourceId },
          data: { guestProfileId: targetId },
        }),
        tx.folio.updateMany({
          where: { guestProfileId: sourceId },
          data: { guestProfileId: targetId },
        }),
        tx.guestNote.updateMany({
          where: { guestProfileId: sourceId },
          data: { guestProfileId: targetId },
        }),
        tx.guestPreference.updateMany({
          where: { guestProfileId: sourceId },
          data: { guestProfileId: targetId },
        }),
        tx.loyaltyTransaction.updateMany({
          where: { guestProfileId: sourceId },
          data: { guestProfileId: targetId },
        }),
      ]);

      // Merge totals into target
      const updatedTarget = await tx.guestProfile.update({
        where: { id: targetId },
        data: {
          totalStays: target.totalStays + source.totalStays,
          totalSpend: Number(target.totalSpend) + Number(source.totalSpend),
          loyaltyPoints: target.loyaltyPoints + source.loyaltyPoints,
          loyaltyTier: resolveTier(target.loyaltyPoints + source.loyaltyPoints),
        },
      });

      // Delete source profile
      await tx.guestProfile.delete({ where: { id: sourceId } });

      return { merged: true, targetProfile: updatedTarget };
    });
  }

  // ─────────────────────────────────────────────────────────────────
  //  Guest Notes
  // ─────────────────────────────────────────────────────────────────

  async addGuestNote(
    propertyId: string,
    guestProfileId: string,
    dto: CreateGuestNoteDto,
    authorId: string,
  ) {
    const profile = await this.prisma.guestProfile.findFirst({ where: { id: guestProfileId, propertyId } });
    if (!profile) throw new NotFoundException(`Guest profile ${guestProfileId} not found`);

    return this.prisma.guestNote.create({
      data: {
        guestProfileId,
        authorId,
        type: dto.type,
        content: dto.content,
        isPrivate: dto.isPrivate ?? false,
      },
    });
  }

  async listGuestNotes(propertyId: string, guestProfileId: string) {
    const profile = await this.prisma.guestProfile.findFirst({ where: { id: guestProfileId, propertyId } });
    if (!profile) throw new NotFoundException(`Guest profile ${guestProfileId} not found`);

    return this.prisma.guestNote.findMany({
      where: { guestProfileId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteGuestNote(propertyId: string, noteId: string, userId: string) {
    const note = await this.prisma.guestNote.findFirst({
      where: { id: noteId },
      include: { guestProfile: { select: { propertyId: true } } },
    });

    if (!note || note.guestProfile.propertyId !== propertyId) {
      throw new NotFoundException(`Guest note ${noteId} not found`);
    }

    // Only the author can delete their own note (GMs can delete any via role guard)
    if (note.authorId !== userId) {
      const user = await this.prisma.user.findFirst({
        where: { id: userId, propertyId },
        select: { role: true },
      });
      if (!user || !['ADMIN', 'GM'].includes(user.role)) {
        throw new ForbiddenException('Only the note author or a GM/Admin can delete this note');
      }
    }

    return this.prisma.guestNote.delete({ where: { id: noteId } });
  }

  // ─────────────────────────────────────────────────────────────────
  //  Guest Preferences
  // ─────────────────────────────────────────────────────────────────

  async addPreference(propertyId: string, guestProfileId: string, dto: CreateGuestPreferenceDto) {
    const profile = await this.prisma.guestProfile.findFirst({ where: { id: guestProfileId, propertyId } });
    if (!profile) throw new NotFoundException(`Guest profile ${guestProfileId} not found`);

    return this.prisma.guestPreference.create({
      data: {
        guestProfileId,
        category: dto.category,
        preference: dto.preference,
        notes: dto.notes,
      },
    });
  }

  async listPreferences(propertyId: string, guestProfileId: string) {
    const profile = await this.prisma.guestProfile.findFirst({ where: { id: guestProfileId, propertyId } });
    if (!profile) throw new NotFoundException(`Guest profile ${guestProfileId} not found`);

    return this.prisma.guestPreference.findMany({
      where: { guestProfileId },
      orderBy: { category: 'asc' },
    });
  }

  async deletePreference(propertyId: string, prefId: string) {
    const pref = await this.prisma.guestPreference.findFirst({
      where: { id: prefId },
      include: { guestProfile: { select: { propertyId: true } } },
    });

    if (!pref || pref.guestProfile.propertyId !== propertyId) {
      throw new NotFoundException(`Preference ${prefId} not found`);
    }

    return this.prisma.guestPreference.delete({ where: { id: prefId } });
  }

  // ─────────────────────────────────────────────────────────────────
  //  Loyalty
  // ─────────────────────────────────────────────────────────────────

  async adjustLoyaltyPoints(
    propertyId: string,
    guestProfileId: string,
    dto: AdjustLoyaltyPointsDto,
  ) {
    const profile = await this.prisma.guestProfile.findFirst({
      where: { id: guestProfileId, propertyId },
    });
    if (!profile) throw new NotFoundException(`Guest profile ${guestProfileId} not found`);

    const newPoints = profile.loyaltyPoints + dto.points;
    if (newPoints < 0) {
      throw new BadRequestException(
        `Insufficient loyalty points. Current: ${profile.loyaltyPoints}, Requested: ${Math.abs(dto.points)}`,
      );
    }

    const newTier = resolveTier(newPoints);

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.loyaltyTransaction.create({
        data: {
          guestProfileId,
          type: dto.type,
          points: dto.points,
          balanceAfter: newPoints,
          description: dto.description,
          referenceType: dto.referenceType,
          referenceId: dto.referenceId,
        },
      });

      const updatedProfile = await tx.guestProfile.update({
        where: { id: guestProfileId },
        data: {
          loyaltyPoints: newPoints,
          loyaltyTier: newTier,
        },
      });

      return { transaction, updatedProfile, newBalance: newPoints, newTier };
    });
  }

  async getLoyaltyHistory(
    propertyId: string,
    guestProfileId: string,
    skip = 0,
    take = 20,
  ) {
    const profile = await this.prisma.guestProfile.findFirst({ where: { id: guestProfileId, propertyId } });
    if (!profile) throw new NotFoundException(`Guest profile ${guestProfileId} not found`);

    const [items, total] = await Promise.all([
      this.prisma.loyaltyTransaction.findMany({
        where: { guestProfileId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.loyaltyTransaction.count({ where: { guestProfileId } }),
    ]);

    return { items, total, skip, take, currentBalance: profile.loyaltyPoints };
  }

  // ─────────────────────────────────────────────────────────────────
  //  VIP & Blacklist
  // ─────────────────────────────────────────────────────────────────

  async setVipStatus(
    propertyId: string,
    guestProfileId: string,
    isVip: boolean,
    reason: string,
    userId: string,
  ) {
    const profile = await this.prisma.guestProfile.findFirst({ where: { id: guestProfileId, propertyId } });
    if (!profile) throw new NotFoundException(`Guest profile ${guestProfileId} not found`);

    return this.prisma.guestProfile.update({
      where: { id: guestProfileId },
      data: {
        isVip,
        vipReason: isVip ? reason : null,
      },
    });
  }

  // HARD LIMIT — blacklist is MANUAL ONLY — no automation ever
  async blacklistGuest(
    propertyId: string,
    guestProfileId: string,
    dto: BlacklistGuestDto,
    userId: string,
  ) {
    // HARD LIMIT: Guest blacklisting is always manual — never automated by AI or system rules
    const profile = await this.prisma.guestProfile.findFirst({ where: { id: guestProfileId, propertyId } });
    if (!profile) throw new NotFoundException(`Guest profile ${guestProfileId} not found`);

    if (profile.isBlacklisted) {
      throw new ConflictException('Guest is already blacklisted');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.guestProfile.update({
        where: { id: guestProfileId },
        data: {
          isBlacklisted: true,
          blacklistReason: dto.reason,
          blacklistedAt: new Date(),
          blacklistedById: userId,
        },
      });

      // Create an audit note for the blacklisting
      await tx.guestNote.create({
        data: {
          guestProfileId,
          authorId: userId,
          type: 'blacklist',
          content: `Guest blacklisted. Reason: ${dto.reason}`,
          isPrivate: true,
        },
      });

      return updated;
    });
  }

  async removeFromBlacklist(propertyId: string, guestProfileId: string, userId: string) {
    const profile = await this.prisma.guestProfile.findFirst({ where: { id: guestProfileId, propertyId } });
    if (!profile) throw new NotFoundException(`Guest profile ${guestProfileId} not found`);

    if (!profile.isBlacklisted) {
      throw new ConflictException('Guest is not blacklisted');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.guestProfile.update({
        where: { id: guestProfileId },
        data: {
          isBlacklisted: false,
          blacklistReason: null,
          blacklistedAt: null,
          blacklistedById: null,
        },
      });

      await tx.guestNote.create({
        data: {
          guestProfileId,
          authorId: userId,
          type: 'general',
          content: `Guest removed from blacklist by user ${userId}`,
          isPrivate: true,
        },
      });

      return updated;
    });
  }

  // ─────────────────────────────────────────────────────────────────
  //  Stay History & Spend Summary
  // ─────────────────────────────────────────────────────────────────

  async getGuestStayHistory(
    propertyId: string,
    guestProfileId: string,
    skip = 0,
    take = 20,
  ) {
    const profile = await this.prisma.guestProfile.findFirst({ where: { id: guestProfileId, propertyId } });
    if (!profile) throw new NotFoundException(`Guest profile ${guestProfileId} not found`);

    const [items, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where: { guestProfileId, propertyId },
        orderBy: { checkInDate: 'desc' },
        skip,
        take,
        select: {
          id: true,
          confirmationNo: true,
          status: true,
          checkInDate: true,
          checkOutDate: true,
          actualCheckIn: true,
          actualCheckOut: true,
          rateAmount: true,
          totalAmount: true,
          source: true,
          adults: true,
          children: true,
          createdAt: true,
        },
      }),
      this.prisma.reservation.count({ where: { guestProfileId, propertyId } }),
    ]);

    return { items, total, skip, take };
  }

  async getGuestSpendSummary(propertyId: string, guestProfileId: string) {
    const profile = await this.prisma.guestProfile.findFirst({ where: { id: guestProfileId, propertyId } });
    if (!profile) throw new NotFoundException(`Guest profile ${guestProfileId} not found`);

    // Sum folio items for this guest
    const folios = await this.prisma.folio.findMany({
      where: { guestProfileId, propertyId },
      include: {
        items: {
          where: { isVoid: false },
          select: { description: true, amount: true, referenceType: true },
        },
      },
    });

    let roomCharges = 0;
    let fbCharges = 0;
    let otherCharges = 0;
    let totalFolioCharges = 0;

    for (const folio of folios) {
      for (const item of folio.items) {
        const amount = Number(item.amount);
        totalFolioCharges += amount;
        if (item.referenceType === 'room_charge') roomCharges += amount;
        else if (item.referenceType === 'pos_charge' || item.referenceType === 'fb') fbCharges += amount;
        else otherCharges += amount;
      }
    }

    // Sum POS bills for this guest
    const bills = await this.prisma.bill.findMany({
      where: {
        propertyId,
        order: { guestProfileId },
        status: { not: 'VOID' },
      },
      select: { total: true },
    });

    const totalPosBills = bills.reduce((sum, b) => sum + Number(b.total), 0);

    return {
      guestProfileId,
      loyaltyPoints: profile.loyaltyPoints,
      loyaltyTier: profile.loyaltyTier,
      totalStays: profile.totalStays,
      totalSpend: Number(profile.totalSpend),
      breakdown: {
        roomCharges: Math.round(roomCharges * 100) / 100,
        fbCharges: Math.round(fbCharges * 100) / 100,
        otherFolioCharges: Math.round(otherCharges * 100) / 100,
        posBills: Math.round(totalPosBills * 100) / 100,
        totalFolioCharges: Math.round(totalFolioCharges * 100) / 100,
      },
    };
  }
}
