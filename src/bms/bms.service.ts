import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AssetStatus, MaintenanceRequestStatus, MaintenancePriority, WorkOrderStatus } from '@prisma/client';
import { CreateAssetDto } from './dto/create-asset.dto';
import { CreateMaintenanceRequestDto } from './dto/create-maintenance-request.dto';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';

@Injectable()
export class BmsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────
  //  ASSETS
  // ─────────────────────────────────────────────────────────

  async createAsset(propertyId: string, dto: CreateAssetDto) {
    const existing = await this.prisma.asset.findFirst({
      where: { propertyId, assetTag: dto.assetTag },
    });
    if (existing) {
      throw new ConflictException(`Asset tag '${dto.assetTag}' already exists for this property`);
    }

    return this.prisma.asset.create({
      data: {
        propertyId,
        name: dto.name,
        assetTag: dto.assetTag,
        category: dto.category,
        location: dto.location,
        manufacturer: dto.manufacturer ?? null,
        model: dto.model ?? null,
        serialNumber: dto.serialNumber ?? null,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        purchaseCost: dto.purchaseCost ?? null,
        warrantyExpiry: dto.warrantyExpiry ? new Date(dto.warrantyExpiry) : null,
        nextServiceDate: dto.nextServiceDate ? new Date(dto.nextServiceDate) : null,
        notes: dto.notes ?? null,
        status: AssetStatus.ACTIVE,
      },
    });
  }

  async listAssets(
    propertyId: string,
    params: { category?: string; status?: AssetStatus; skip?: number; take?: number },
  ) {
    const { category, status, skip = 0, take = 30 } = params;

    const where: any = { propertyId };
    if (category) where.category = category;
    if (status) where.status = status;

    const [assets, total] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        include: {
          _count: { select: { maintenanceReqs: true, workOrders: true } },
        },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.asset.count({ where }),
    ]);

    return { assets, total, skip, take };
  }

  async getAsset(propertyId: string, id: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id, propertyId },
      include: {
        maintenanceReqs: {
          where: { status: { not: MaintenanceRequestStatus.CANCELLED } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        pmSchedules: { where: { isActive: true } },
        workOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async updateAsset(propertyId: string, id: string, dto: Partial<CreateAssetDto>) {
    const asset = await this.prisma.asset.findFirst({ where: { id, propertyId } });
    if (!asset) throw new NotFoundException('Asset not found');

    if (dto.assetTag && dto.assetTag !== asset.assetTag) {
      const collision = await this.prisma.asset.findFirst({
        where: { propertyId, assetTag: dto.assetTag, id: { not: id } },
      });
      if (collision) {
        throw new ConflictException(`Asset tag '${dto.assetTag}' already exists for this property`);
      }
    }

    return this.prisma.asset.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.assetTag !== undefined && { assetTag: dto.assetTag }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.manufacturer !== undefined && { manufacturer: dto.manufacturer }),
        ...(dto.model !== undefined && { model: dto.model }),
        ...(dto.serialNumber !== undefined && { serialNumber: dto.serialNumber }),
        ...(dto.purchaseDate !== undefined && { purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null }),
        ...(dto.purchaseCost !== undefined && { purchaseCost: dto.purchaseCost }),
        ...(dto.warrantyExpiry !== undefined && { warrantyExpiry: dto.warrantyExpiry ? new Date(dto.warrantyExpiry) : null }),
        ...(dto.nextServiceDate !== undefined && { nextServiceDate: dto.nextServiceDate ? new Date(dto.nextServiceDate) : null }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async updateAssetStatus(propertyId: string, id: string, status: AssetStatus) {
    const asset = await this.prisma.asset.findFirst({ where: { id, propertyId } });
    if (!asset) throw new NotFoundException('Asset not found');

    return this.prisma.asset.update({ where: { id }, data: { status } });
  }

  // ─────────────────────────────────────────────────────────
  //  MAINTENANCE REQUESTS
  // ─────────────────────────────────────────────────────────

  async createMaintenanceRequest(
    propertyId: string,
    dto: CreateMaintenanceRequestDto,
    reportedById: string,
  ) {
    if (dto.assetId) {
      const asset = await this.prisma.asset.findFirst({ where: { id: dto.assetId, propertyId } });
      if (!asset) throw new NotFoundException('Asset not found');
      if (asset.status === AssetStatus.DISPOSED) {
        throw new BadRequestException('Cannot raise a maintenance request for a disposed asset');
      }
    }

    if (dto.roomId) {
      const room = await this.prisma.room.findFirst({ where: { id: dto.roomId, propertyId } });
      if (!room) throw new NotFoundException('Room not found');
    }

    return this.prisma.maintenanceRequest.create({
      data: {
        propertyId,
        assetId: dto.assetId ?? null,
        roomId: dto.roomId ?? null,
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        status: MaintenanceRequestStatus.OPEN,
        reportedById,
        imageUrls: dto.imageUrls ?? [],
      },
      include: {
        asset: true,
      },
    });
  }

  async listMaintenanceRequests(
    propertyId: string,
    params: {
      status?: MaintenanceRequestStatus;
      priority?: MaintenancePriority;
      assetId?: string;
      skip?: number;
      take?: number;
    },
  ) {
    const { status, priority, assetId, skip = 0, take = 30 } = params;

    const where: any = { propertyId };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assetId) where.assetId = assetId;

    const [requests, total] = await Promise.all([
      this.prisma.maintenanceRequest.findMany({
        where,
        include: {
          asset: { select: { id: true, name: true, assetTag: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { workOrders: true } },
        },
        orderBy: [
          { priority: 'asc' },
          { createdAt: 'desc' },
        ],
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.maintenanceRequest.count({ where }),
    ]);

    return { requests, total, skip, take };
  }

  async getMaintenanceRequest(propertyId: string, id: string) {
    const req = await this.prisma.maintenanceRequest.findFirst({
      where: { id, propertyId },
      include: {
        asset: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        workOrders: {
          include: {
            assignedTo: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!req) throw new NotFoundException('Maintenance request not found');
    return req;
  }

  async assignMaintenanceRequest(
    propertyId: string,
    id: string,
    assignedToId: string,
  ) {
    const req = await this.prisma.maintenanceRequest.findFirst({ where: { id, propertyId } });
    if (!req) throw new NotFoundException('Maintenance request not found');
    if (req.status === MaintenanceRequestStatus.RESOLVED || req.status === MaintenanceRequestStatus.CANCELLED) {
      throw new BadRequestException(`Cannot assign a ${req.status} request`);
    }

    const user = await this.prisma.user.findFirst({ where: { id: assignedToId, propertyId } });
    if (!user) throw new NotFoundException('User not found in this property');

    return this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        assignedToId,
        status: MaintenanceRequestStatus.IN_PROGRESS,
      },
    });
  }

  async updateMaintenanceRequestStatus(
    propertyId: string,
    id: string,
    status: MaintenanceRequestStatus,
    resolution?: string,
  ) {
    const req = await this.prisma.maintenanceRequest.findFirst({ where: { id, propertyId } });
    if (!req) throw new NotFoundException('Maintenance request not found');

    if (req.status === MaintenanceRequestStatus.CANCELLED) {
      throw new BadRequestException('Cannot update a cancelled request');
    }

    if (status === MaintenanceRequestStatus.RESOLVED && !resolution) {
      throw new BadRequestException('Resolution notes are required when resolving a request');
    }

    return this.prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status,
        ...(status === MaintenanceRequestStatus.RESOLVED && {
          resolution,
          resolvedAt: new Date(),
        }),
      },
    });
  }

  async closeMaintenanceRequest(
    propertyId: string,
    id: string,
    resolution: string,
    userId: string,
  ) {
    const req = await this.prisma.maintenanceRequest.findFirst({ where: { id, propertyId } });
    if (!req) throw new NotFoundException('Maintenance request not found');

    if (req.status === MaintenanceRequestStatus.CANCELLED) {
      throw new BadRequestException('Request is already cancelled');
    }
    if (req.status === MaintenanceRequestStatus.RESOLVED) {
      throw new BadRequestException('Request is already resolved');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: MaintenanceRequestStatus.RESOLVED,
          resolution,
          resolvedAt: new Date(),
        },
      });

      // Close any open work orders tied to this request
      await tx.workOrder.updateMany({
        where: {
          maintenanceRequestId: id,
          status: { in: [WorkOrderStatus.ASSIGNED, WorkOrderStatus.IN_PROGRESS] },
        },
        data: {
          status: WorkOrderStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      return updated;
    });
  }

  // ─────────────────────────────────────────────────────────
  //  WORK ORDERS
  // ─────────────────────────────────────────────────────────

  async createWorkOrder(propertyId: string, dto: CreateWorkOrderDto) {
    // Verify assigned technician belongs to this property
    const assignee = await this.prisma.user.findFirst({
      where: { id: dto.assignedToId, propertyId },
    });
    if (!assignee) throw new NotFoundException('Assigned user not found in this property');

    if (dto.maintenanceRequestId) {
      const req = await this.prisma.maintenanceRequest.findFirst({
        where: { id: dto.maintenanceRequestId, propertyId },
      });
      if (!req) throw new NotFoundException('Maintenance request not found');
    }

    if (dto.assetId) {
      const asset = await this.prisma.asset.findFirst({ where: { id: dto.assetId, propertyId } });
      if (!asset) throw new NotFoundException('Asset not found');
    }

    if (dto.roomId) {
      const room = await this.prisma.room.findFirst({ where: { id: dto.roomId, propertyId } });
      if (!room) throw new NotFoundException('Room not found');
    }

    const orderNumber = `WO-${Date.now()}`;

    return this.prisma.workOrder.create({
      data: {
        propertyId,
        maintenanceRequestId: dto.maintenanceRequestId ?? null,
        pmScheduleId: dto.pmScheduleId ?? null,
        assetId: dto.assetId ?? null,
        roomId: dto.roomId ?? null,
        orderNumber,
        title: dto.title,
        description: dto.description,
        status: WorkOrderStatus.ASSIGNED,
        assignedToId: dto.assignedToId,
        laborMinutes: dto.laborMinutes ?? null,
        notes: dto.notes ?? null,
      },
      include: {
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        asset: { select: { id: true, name: true, assetTag: true } },
      },
    });
  }

  async listWorkOrders(
    propertyId: string,
    params: {
      status?: WorkOrderStatus;
      assignedToId?: string;
      assetId?: string;
      skip?: number;
      take?: number;
    },
  ) {
    const { status, assignedToId, assetId, skip = 0, take = 30 } = params;

    const where: any = { propertyId };
    if (status) where.status = status;
    if (assignedToId) where.assignedToId = assignedToId;
    if (assetId) where.assetId = assetId;

    const [orders, total] = await Promise.all([
      this.prisma.workOrder.findMany({
        where,
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          asset: { select: { id: true, name: true, assetTag: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.workOrder.count({ where }),
    ]);

    return { orders, total, skip, take };
  }

  async updateWorkOrderStatus(
    propertyId: string,
    id: string,
    status: WorkOrderStatus,
    laborMinutes?: number,
    notes?: string,
  ) {
    const order = await this.prisma.workOrder.findFirst({ where: { id, propertyId } });
    if (!order) throw new NotFoundException('Work order not found');

    if (order.status === WorkOrderStatus.COMPLETED || order.status === WorkOrderStatus.REJECTED) {
      throw new BadRequestException(`Cannot update a ${order.status} work order`);
    }

    return this.prisma.workOrder.update({
      where: { id },
      data: {
        status,
        ...(status === WorkOrderStatus.IN_PROGRESS && !order.startedAt && { startedAt: new Date() }),
        ...(status === WorkOrderStatus.COMPLETED && {
          completedAt: new Date(),
          ...(laborMinutes !== undefined && { laborMinutes }),
        }),
        ...(notes !== undefined && { notes }),
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  PREVENTIVE MAINTENANCE SCHEDULES
  // ─────────────────────────────────────────────────────────

  async listPMSchedules(propertyId: string, dueOnly = false) {
    const where: any = { propertyId, isActive: true };
    if (dueOnly) {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      where.nextDueDate = { lte: today };
    }

    return this.prisma.pMSchedule.findMany({
      where,
      include: {
        asset: { select: { id: true, name: true, assetTag: true, location: true } },
      },
      orderBy: { nextDueDate: 'asc' },
    });
  }

  async createPMSchedule(
    propertyId: string,
    dto: {
      assetId: string;
      name: string;
      description?: string;
      frequencyDays: number;
      nextDueDate: string;
      estimatedMinutes?: number;
      assignedDeptId?: string;
    },
  ) {
    const asset = await this.prisma.asset.findFirst({ where: { id: dto.assetId, propertyId } });
    if (!asset) throw new NotFoundException('Asset not found');

    return this.prisma.pMSchedule.create({
      data: {
        propertyId,
        assetId: dto.assetId,
        name: dto.name,
        description: dto.description ?? null,
        frequencyDays: dto.frequencyDays,
        nextDueDate: new Date(dto.nextDueDate),
        estimatedMinutes: dto.estimatedMinutes ?? 60,
        assignedDeptId: dto.assignedDeptId ?? null,
        isActive: true,
      },
      include: { asset: true },
    });
  }

  async generateWorkOrdersFromDueSchedules(propertyId: string, assignedToId: string) {
    const assignee = await this.prisma.user.findFirst({
      where: { id: assignedToId, propertyId },
    });
    if (!assignee) throw new NotFoundException('Assigned user not found in this property');

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const dueSchedules = await this.prisma.pMSchedule.findMany({
      where: { propertyId, isActive: true, nextDueDate: { lte: today } },
      include: { asset: true },
    });

    if (dueSchedules.length === 0) {
      return { generated: 0, workOrders: [] };
    }

    const workOrders = await this.prisma.$transaction(async (tx) => {
      const created: any[] = [];

      for (const schedule of dueSchedules) {
        const orderNumber = `WO-PM-${schedule.id.slice(0, 8)}-${Date.now()}`;

        const wo = await tx.workOrder.create({
          data: {
            propertyId,
            pmScheduleId: schedule.id,
            assetId: schedule.assetId,
            orderNumber,
            title: `[PM] ${schedule.name}`,
            description: schedule.description ?? `Preventive maintenance for ${schedule.asset.name}`,
            status: WorkOrderStatus.ASSIGNED,
            assignedToId,
          },
        });
        created.push(wo);

        // Advance the next due date by frequency
        const nextDue = new Date(schedule.nextDueDate);
        nextDue.setDate(nextDue.getDate() + schedule.frequencyDays);

        await tx.pMSchedule.update({
          where: { id: schedule.id },
          data: {
            lastPerformedAt: new Date(),
            nextDueDate: nextDue,
          },
        });
      }

      return created;
    });

    return { generated: workOrders.length, workOrders };
  }
}
