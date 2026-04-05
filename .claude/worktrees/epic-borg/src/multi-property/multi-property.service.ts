import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreatePropertyGroupDto } from './dto/create-property-group.dto';
import { AddPropertyToGroupDto } from './dto/add-property-to-group.dto';

@Injectable()
export class MultiPropertyService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────
  //  PROPERTY GROUPS
  // ─────────────────────────────────────────────────────────

  async createPropertyGroup(dto: CreatePropertyGroupDto) {
    return this.prisma.propertyGroup.create({
      data: {
        name: dto.name,
        description: dto.description,
        headOffice: dto.headOffice,
      },
    });
  }

  async listPropertyGroups(skip = 0, take = 20) {
    const [groups, total] = await Promise.all([
      this.prisma.propertyGroup.findMany({
        include: {
          members: {
            include: { property: { select: { id: true, name: true, city: true, country: true } } },
          },
        },
        orderBy: { name: 'asc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.propertyGroup.count(),
    ]);

    return { groups, total, skip, take };
  }

  async getPropertyGroup(id: string) {
    const group = await this.prisma.propertyGroup.findUnique({
      where: { id },
      include: {
        members: {
          include: { property: true },
        },
      },
    });
    if (!group) throw new NotFoundException('Property group not found');
    return group;
  }

  async updatePropertyGroup(id: string, dto: Partial<CreatePropertyGroupDto>) {
    const group = await this.prisma.propertyGroup.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('Property group not found');

    return this.prisma.propertyGroup.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.headOffice !== undefined && { headOffice: dto.headOffice }),
      },
    });
  }

  async deletePropertyGroup(id: string) {
    const group = await this.prisma.propertyGroup.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('Property group not found');

    return this.prisma.propertyGroup.delete({ where: { id } });
  }

  // ─────────────────────────────────────────────────────────
  //  MEMBERSHIP
  // ─────────────────────────────────────────────────────────

  async addPropertyToGroup(groupId: string, dto: AddPropertyToGroupDto) {
    const group = await this.prisma.propertyGroup.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundException('Property group not found');

    const property = await this.prisma.property.findUnique({
      where: { id: dto.propertyId },
    });
    if (!property) throw new NotFoundException('Property not found');

    const existing = await this.prisma.propertyGroupMember.findUnique({
      where: {
        propertyGroupId_propertyId: {
          propertyGroupId: groupId,
          propertyId: dto.propertyId,
        },
      },
    });
    if (existing) {
      throw new ConflictException('Property is already a member of this group');
    }

    return this.prisma.propertyGroupMember.create({
      data: {
        propertyGroupId: groupId,
        propertyId: dto.propertyId,
        role: dto.role ?? 'member',
      },
      include: { property: true },
    });
  }

  async removePropertyFromGroup(groupId: string, propertyId: string) {
    const member = await this.prisma.propertyGroupMember.findUnique({
      where: {
        propertyGroupId_propertyId: { propertyGroupId: groupId, propertyId },
      },
    });
    if (!member) throw new NotFoundException('Property is not a member of this group');

    return this.prisma.propertyGroupMember.delete({
      where: {
        propertyGroupId_propertyId: { propertyGroupId: groupId, propertyId },
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  CROSS-PROPERTY REPORTS
  // ─────────────────────────────────────────────────────────

  async crossPropertyOccupancyReport(groupId: string) {
    const group = await this.prisma.propertyGroup.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) throw new NotFoundException('Property group not found');

    const propertyIds = group.members.map((m) => m.propertyId);

    const reports = await Promise.all(
      propertyIds.map(async (propertyId) => {
        const [totalRooms, occupiedRooms, property] = await Promise.all([
          this.prisma.room.count({ where: { propertyId, isOOO: false } }),
          this.prisma.room.count({
            where: {
              propertyId,
              status: { in: ['OCCUPIED_CLEAN', 'OCCUPIED_DIRTY'] },
            },
          }),
          this.prisma.property.findUnique({
            where: { id: propertyId },
            select: { id: true, name: true, city: true, country: true },
          }),
        ]);

        const occupancyPct =
          totalRooms > 0 ? +((occupiedRooms / totalRooms) * 100).toFixed(2) : 0;

        return { property, totalRooms, occupiedRooms, occupancyPct };
      }),
    );

    const groupTotalRooms = reports.reduce((s, r) => s + r.totalRooms, 0);
    const groupOccupied = reports.reduce((s, r) => s + r.occupiedRooms, 0);
    const groupOccupancy =
      groupTotalRooms > 0
        ? +((groupOccupied / groupTotalRooms) * 100).toFixed(2)
        : 0;

    return {
      groupId,
      groupName: group.name,
      summary: { totalRooms: groupTotalRooms, occupiedRooms: groupOccupied, occupancyPct: groupOccupancy },
      properties: reports,
    };
  }

  async gmDashboard(groupId: string) {
    const group = await this.prisma.propertyGroup.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) throw new NotFoundException('Property group not found');

    const propertyIds = group.members.map((m) => m.propertyId);

    const kpis = await Promise.all(
      propertyIds.map(async (propertyId) => {
        const property = await this.prisma.property.findUnique({
          where: { id: propertyId },
          select: { id: true, name: true, city: true, country: true },
        });

        // Latest night audit KPIs
        const latestAudit = await this.prisma.nightAudit.findFirst({
          where: { propertyId },
          orderBy: { auditDate: 'desc' },
        });

        // In-house count
        const inHouse = await this.prisma.reservation.count({
          where: { propertyId, status: 'CHECKED_IN' },
        });

        // Arrivals today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const arrivals = await this.prisma.reservation.count({
          where: {
            propertyId,
            status: 'CONFIRMED',
            checkInDate: { gte: today, lt: tomorrow },
          },
        });

        const departures = await this.prisma.reservation.count({
          where: {
            propertyId,
            status: 'CHECKED_IN',
            checkOutDate: { gte: today, lt: tomorrow },
          },
        });

        return {
          property,
          inHouse,
          arrivals,
          departures,
          lastNightAudit: latestAudit
            ? {
                auditDate: latestAudit.auditDate,
                occupancyPct: latestAudit.occupancyPct,
                adr: latestAudit.adr,
                revpar: latestAudit.revpar,
                totalRevenue: latestAudit.totalRevenue,
              }
            : null,
        };
      }),
    );

    return {
      groupId,
      groupName: group.name,
      generatedAt: new Date(),
      properties: kpis,
    };
  }

  async crossPropertyGuestLookup(
    groupId: string,
    query: { email?: string; passportNo?: string; phone?: string },
  ) {
    const group = await this.prisma.propertyGroup.findUnique({
      where: { id: groupId },
      include: { members: true },
    });
    if (!group) throw new NotFoundException('Property group not found');

    const propertyIds = group.members.map((m) => m.propertyId);

    if (!query.email && !query.passportNo && !query.phone) {
      throw new NotFoundException('Provide at least one search parameter: email, passportNo, or phone');
    }

    const where: any = {
      propertyId: { in: propertyIds },
    };
    if (query.email) where.email = query.email;
    if (query.passportNo) where.passportNo = query.passportNo;
    if (query.phone) where.phone = query.phone;

    const guests = await this.prisma.guestProfile.findMany({
      where,
      include: {
        property: { select: { id: true, name: true } },
        reservations: {
          where: { status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
          orderBy: { checkInDate: 'desc' },
          take: 3,
        },
      },
    });

    return { count: guests.length, guests };
  }
}
