import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { IncidentSeverity } from '@prisma/client';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { AssignKeyCardDto } from './dto/assign-key-card.dto';
import { LogAccessDto } from './dto/log-access.dto';

@Injectable()
export class SecurityService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────
  //  ACCESS LOG — append-only, no updates or deletes
  // ─────────────────────────────────────────────────────────

  async logAccess(propertyId: string, dto: LogAccessDto) {
    if (dto.userId) {
      const user = await this.prisma.user.findFirst({
        where: { id: dto.userId, propertyId },
      });
      if (!user) throw new NotFoundException('User not found in this property');
    }

    // Access log is append-only — never update or delete entries
    return this.prisma.accessLog.create({
      data: {
        propertyId,
        userId: dto.userId ?? null,
        location: dto.location,
        accessType: dto.accessType,
        method: dto.method,
        cardNumber: dto.cardNumber ?? null,
        notes: dto.notes ?? null,
        timestamp: new Date(),
      },
    });
  }

  async listAccessLogs(
    propertyId: string,
    params: {
      location?: string;
      accessType?: string;
      userId?: string;
      fromTime?: string;
      toTime?: string;
      skip?: number;
      take?: number;
    },
  ) {
    const { location, accessType, userId, fromTime, toTime, skip = 0, take = 50 } = params;

    const where: any = { propertyId };
    if (location) where.location = { contains: location, mode: 'insensitive' };
    if (accessType) where.accessType = accessType;
    if (userId) where.userId = userId;
    if (fromTime || toTime) {
      where.timestamp = {};
      if (fromTime) where.timestamp.gte = new Date(fromTime);
      if (toTime) where.timestamp.lte = new Date(toTime);
    }

    const [logs, total] = await Promise.all([
      this.prisma.accessLog.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
        orderBy: { timestamp: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.accessLog.count({ where }),
    ]);

    return { logs, total, skip, take };
  }

  async getAccessLog(propertyId: string, id: string) {
    const log = await this.prisma.accessLog.findFirst({
      where: { id, propertyId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });
    if (!log) throw new NotFoundException('Access log entry not found');
    return log;
  }

  // ─────────────────────────────────────────────────────────
  //  INCIDENT REPORTS
  // ─────────────────────────────────────────────────────────

  async createIncident(propertyId: string, dto: CreateIncidentDto, reportedById: string) {
    if (dto.guestProfileId) {
      const guest = await this.prisma.guestProfile.findFirst({
        where: { id: dto.guestProfileId, propertyId },
      });
      if (!guest) throw new NotFoundException('Guest profile not found');
    }

    const reportNumber = `INC-${Date.now()}`;

    return this.prisma.incidentReport.create({
      data: {
        propertyId,
        reportNumber,
        title: dto.title,
        description: dto.description,
        severity: dto.severity,
        location: dto.location ?? null,
        guestProfileId: dto.guestProfileId ?? null,
        reportedById,
        witnessNames: dto.witnessNames ?? [],
        status: 'open',
      },
    });
  }

  async listIncidents(
    propertyId: string,
    params: {
      status?: string;
      severity?: IncidentSeverity;
      skip?: number;
      take?: number;
    },
  ) {
    const { status, severity, skip = 0, take = 30 } = params;

    const where: any = { propertyId };
    if (status) where.status = status;
    if (severity) where.severity = severity;

    const [incidents, total] = await Promise.all([
      this.prisma.incidentReport.findMany({
        where,
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.incidentReport.count({ where }),
    ]);

    return { incidents, total, skip, take };
  }

  async getIncident(propertyId: string, id: string) {
    const incident = await this.prisma.incidentReport.findFirst({
      where: { id, propertyId },
    });
    if (!incident) throw new NotFoundException('Incident report not found');
    return incident;
  }

  async updateIncident(
    propertyId: string,
    id: string,
    dto: Partial<CreateIncidentDto> & { assignedToId?: string; status?: string },
  ) {
    const incident = await this.prisma.incidentReport.findFirst({ where: { id, propertyId } });
    if (!incident) throw new NotFoundException('Incident report not found');

    if (incident.status === 'closed') {
      throw new BadRequestException('Cannot update a closed incident report');
    }

    if (dto.assignedToId) {
      const user = await this.prisma.user.findFirst({
        where: { id: dto.assignedToId, propertyId },
      });
      if (!user) throw new NotFoundException('Assigned user not found in this property');
    }

    return this.prisma.incidentReport.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.severity !== undefined && { severity: dto.severity }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.witnessNames !== undefined && { witnessNames: dto.witnessNames }),
        ...(dto.assignedToId !== undefined && { assignedToId: dto.assignedToId }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async resolveIncident(
    propertyId: string,
    id: string,
    resolution: string,
    userId: string,
  ) {
    const incident = await this.prisma.incidentReport.findFirst({ where: { id, propertyId } });
    if (!incident) throw new NotFoundException('Incident report not found');

    if (incident.status === 'resolved' || incident.status === 'closed') {
      throw new BadRequestException(`Incident is already ${incident.status}`);
    }

    return this.prisma.incidentReport.update({
      where: { id },
      data: {
        status: 'resolved',
        resolution,
        resolvedAt: new Date(),
      },
    });
  }

  async deleteIncident(propertyId: string, id: string) {
    const incident = await this.prisma.incidentReport.findFirst({ where: { id, propertyId } });
    if (!incident) throw new NotFoundException('Incident report not found');

    // Only allow deletion of open, unassigned incidents
    if (incident.status !== 'open' || incident.assignedToId) {
      throw new ForbiddenException(
        'Only open, unassigned incidents may be deleted. Close or resolve the incident instead.',
      );
    }

    return this.prisma.incidentReport.delete({ where: { id } });
  }

  // ─────────────────────────────────────────────────────────
  //  KEY CARD ASSIGNMENTS
  // ─────────────────────────────────────────────────────────

  async assignKeyCard(propertyId: string, dto: AssignKeyCardDto, issuedById: string) {
    // HARD LIMIT: guest ID verification required before issuing a key card
    if (!dto.guestProfileId) {
      throw new BadRequestException(
        'Guest profile ID is required. Key cards must not be issued without verified guest identity.',
      );
    }

    const guest = await this.prisma.guestProfile.findFirst({
      where: { id: dto.guestProfileId, propertyId },
    });
    if (!guest) throw new NotFoundException('Guest profile not found');

    if (guest.isBlacklisted) {
      throw new ForbiddenException(
        'Cannot issue a key card to a blacklisted guest. Escalate to duty manager.',
      );
    }

    if (dto.roomId) {
      const room = await this.prisma.room.findFirst({ where: { id: dto.roomId, propertyId } });
      if (!room) throw new NotFoundException('Room not found');
    }

    // Check for existing active card for same room+guest (deactivate first)
    const existingActive = await this.prisma.keyCardAssignment.findFirst({
      where: {
        propertyId,
        guestProfileId: dto.guestProfileId,
        ...(dto.roomId && { roomId: dto.roomId }),
        isActive: true,
      },
    });

    if (existingActive) {
      await this.prisma.keyCardAssignment.update({
        where: { id: existingActive.id },
        data: { isActive: false, returnedAt: new Date() },
      });
    }

    return this.prisma.keyCardAssignment.create({
      data: {
        propertyId,
        roomId: dto.roomId ?? null,
        guestProfileId: dto.guestProfileId,
        cardNumber: dto.cardNumber,
        expiresAt: new Date(dto.expiresAt),
        issuedById,
        notes: dto.notes ?? null,
        isActive: true,
      },
    });
  }

  async listKeyCardAssignments(
    propertyId: string,
    params: {
      guestProfileId?: string;
      roomId?: string;
      activeOnly?: boolean;
      skip?: number;
      take?: number;
    },
  ) {
    const { guestProfileId, roomId, activeOnly, skip = 0, take = 30 } = params;

    const where: any = { propertyId };
    if (guestProfileId) where.guestProfileId = guestProfileId;
    if (roomId) where.roomId = roomId;
    if (activeOnly) where.isActive = true;

    const [assignments, total] = await Promise.all([
      this.prisma.keyCardAssignment.findMany({
        where,
        include: {
          room: { select: { id: true, number: true, floor: true } },
        },
        orderBy: { issuedAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.keyCardAssignment.count({ where }),
    ]);

    return { assignments, total, skip, take };
  }

  async returnKeyCard(propertyId: string, id: string) {
    const assignment = await this.prisma.keyCardAssignment.findFirst({
      where: { id, propertyId },
    });
    if (!assignment) throw new NotFoundException('Key card assignment not found');
    if (!assignment.isActive) {
      throw new BadRequestException('Key card is already returned or inactive');
    }

    return this.prisma.keyCardAssignment.update({
      where: { id },
      data: { isActive: false, returnedAt: new Date() },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  SHIFT HANDOVER LOG
  // ─────────────────────────────────────────────────────────

  async createShiftHandover(
    propertyId: string,
    fromUserId: string,
    dto: {
      toUserId: string;
      shiftDate: string;
      summary: string;
      openIssues?: string;
      pendingTasks?: string;
      guestNotes?: string;
      cashBalance?: number;
    },
  ) {
    const toUser = await this.prisma.user.findFirst({
      where: { id: dto.toUserId, propertyId },
    });
    if (!toUser) throw new NotFoundException('Receiving user not found in this property');

    if (fromUserId === dto.toUserId) {
      throw new BadRequestException('Handover must be to a different user');
    }

    return this.prisma.shiftHandover.create({
      data: {
        propertyId,
        fromUserId,
        toUserId: dto.toUserId,
        shiftDate: new Date(dto.shiftDate),
        summary: dto.summary,
        openIssues: dto.openIssues ?? null,
        pendingTasks: dto.pendingTasks ?? null,
        guestNotes: dto.guestNotes ?? null,
        cashBalance: dto.cashBalance ?? null,
      },
      include: {
        fromUser: { select: { id: true, firstName: true, lastName: true, role: true } },
        toUser: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });
  }

  async listShiftHandovers(
    propertyId: string,
    params: { fromDate?: string; toDate?: string; skip?: number; take?: number },
  ) {
    const { fromDate, toDate, skip = 0, take = 30 } = params;

    const where: any = { propertyId };
    if (fromDate || toDate) {
      where.shiftDate = {};
      if (fromDate) where.shiftDate.gte = new Date(fromDate);
      if (toDate) where.shiftDate.lte = new Date(toDate);
    }

    const [handovers, total] = await Promise.all([
      this.prisma.shiftHandover.findMany({
        where,
        include: {
          fromUser: { select: { id: true, firstName: true, lastName: true } },
          toUser: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.shiftHandover.count({ where }),
    ]);

    return { handovers, total, skip, take };
  }
}
