import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma.service';
import { CreateRatePlanDto } from './dto/create-rate-plan.dto';
import { CreateChannelConnectionDto } from './dto/create-channel-connection.dto';
import { SyncAvailabilityDto } from './dto/sync-availability.dto';
import { MapChannelRateDto } from './dto/map-channel-rate.dto';
import { SyncStatus } from '@prisma/client';

@Injectable()
export class ChannelService {
  private readonly logger = new Logger(ChannelService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('channel-sync') private readonly channelSyncQueue: Queue,
  ) {}

  // ─────────────────────────────────────────────────────────────────
  //  Rate Plans
  // ─────────────────────────────────────────────────────────────────

  async createRatePlan(propertyId: string, dto: CreateRatePlanDto) {
    // Verify roomType belongs to this property
    const roomType = await this.prisma.roomType.findFirst({
      where: { id: dto.roomTypeId, propertyId },
    });
    if (!roomType) {
      throw new NotFoundException(`RoomType ${dto.roomTypeId} not found for this property`);
    }

    // Ensure unique code per property
    const existing = await this.prisma.ratePlan.findUnique({
      where: { propertyId_code: { propertyId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(`Rate plan with code '${dto.code}' already exists`);
    }

    return this.prisma.ratePlan.create({
      data: {
        propertyId,
        roomTypeId: dto.roomTypeId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        baseRate: dto.baseRate,
        mealPlan: dto.mealPlan,
        minLOS: dto.minLOS ?? 1,
        maxLOS: dto.maxLOS,
        advanceBooking: dto.advanceBooking,
        cancellationPolicy: dto.cancellationPolicy,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      },
      include: { roomType: true },
    });
  }

  async listRatePlans(propertyId: string, roomTypeId?: string) {
    return this.prisma.ratePlan.findMany({
      where: {
        propertyId,
        isActive: true,
        ...(roomTypeId ? { roomTypeId } : {}),
      },
      include: { roomType: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRatePlan(propertyId: string, id: string, dto: Partial<CreateRatePlanDto>) {
    const plan = await this.prisma.ratePlan.findFirst({ where: { id, propertyId } });
    if (!plan) throw new NotFoundException(`Rate plan ${id} not found`);

    if (dto.roomTypeId) {
      const roomType = await this.prisma.roomType.findFirst({
        where: { id: dto.roomTypeId, propertyId },
      });
      if (!roomType) throw new NotFoundException(`RoomType ${dto.roomTypeId} not found`);
    }

    return this.prisma.ratePlan.update({
      where: { id },
      data: {
        ...(dto.roomTypeId && { roomTypeId: dto.roomTypeId }),
        ...(dto.code && { code: dto.code }),
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.baseRate !== undefined && { baseRate: dto.baseRate }),
        ...(dto.mealPlan && { mealPlan: dto.mealPlan }),
        ...(dto.minLOS !== undefined && { minLOS: dto.minLOS }),
        ...(dto.maxLOS !== undefined && { maxLOS: dto.maxLOS }),
        ...(dto.advanceBooking !== undefined && { advanceBooking: dto.advanceBooking }),
        ...(dto.cancellationPolicy !== undefined && { cancellationPolicy: dto.cancellationPolicy }),
        ...(dto.validFrom !== undefined && { validFrom: dto.validFrom ? new Date(dto.validFrom) : null }),
        ...(dto.validUntil !== undefined && { validUntil: dto.validUntil ? new Date(dto.validUntil) : null }),
      },
      include: { roomType: true },
    });
  }

  async deleteRatePlan(propertyId: string, id: string) {
    const plan = await this.prisma.ratePlan.findFirst({ where: { id, propertyId } });
    if (!plan) throw new NotFoundException(`Rate plan ${id} not found`);

    return this.prisma.ratePlan.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  //  Channel Connections
  // ─────────────────────────────────────────────────────────────────

  async createChannelConnection(propertyId: string, dto: CreateChannelConnectionDto) {
    const existing = await this.prisma.channelConnection.findUnique({
      where: { propertyId_provider: { propertyId, provider: dto.provider } },
    });
    if (existing) {
      throw new ConflictException(
        `A connection for provider '${dto.provider}' already exists for this property`,
      );
    }

    return this.prisma.channelConnection.create({
      data: {
        propertyId,
        provider: dto.provider,
        hotelId: dto.hotelId,
        credentials: dto.credentials,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async listChannelConnections(propertyId: string) {
    return this.prisma.channelConnection.findMany({
      where: { propertyId },
      include: { channelRateMaps: { include: { ratePlan: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateChannelConnection(
    propertyId: string,
    id: string,
    dto: Partial<CreateChannelConnectionDto>,
  ) {
    const connection = await this.prisma.channelConnection.findFirst({
      where: { id, propertyId },
    });
    if (!connection) throw new NotFoundException(`Channel connection ${id} not found`);

    return this.prisma.channelConnection.update({
      where: { id },
      data: {
        ...(dto.hotelId && { hotelId: dto.hotelId }),
        ...(dto.credentials && { credentials: dto.credentials }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async mapChannelRate(propertyId: string, dto: MapChannelRateDto) {
    // Verify connection belongs to property
    const connection = await this.prisma.channelConnection.findFirst({
      where: { id: dto.channelConnectionId, propertyId },
    });
    if (!connection) {
      throw new NotFoundException(`Channel connection ${dto.channelConnectionId} not found`);
    }

    // Verify rate plan belongs to property
    const ratePlan = await this.prisma.ratePlan.findFirst({
      where: { id: dto.ratePlanId, propertyId },
    });
    if (!ratePlan) {
      throw new NotFoundException(`Rate plan ${dto.ratePlanId} not found`);
    }

    return this.prisma.channelRateMapping.create({
      data: {
        channelConnectionId: dto.channelConnectionId,
        ratePlanId: dto.ratePlanId,
        channelRateCode: dto.channelRateCode,
        markup: dto.markup ?? 0,
      },
      include: { ratePlan: true, channelConnection: true },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  //  Availability Sync
  // ─────────────────────────────────────────────────────────────────

  async syncAvailability(
    propertyId: string,
    connectionId: string,
    dto: SyncAvailabilityDto,
  ) {
    const connection = await this.prisma.channelConnection.findFirst({
      where: { id: connectionId, propertyId, isActive: true },
    });
    if (!connection) {
      throw new NotFoundException(`Active channel connection ${connectionId} not found`);
    }

    // Verify roomType belongs to property
    const roomType = await this.prisma.roomType.findFirst({
      where: { id: dto.roomTypeId, propertyId },
    });
    if (!roomType) {
      throw new NotFoundException(`RoomType ${dto.roomTypeId} not found`);
    }

    // Upsert one AvailabilityBlock per date
    const upsertResults = await Promise.all(
      dto.dates.map((dateStr) => {
        const date = new Date(dateStr);
        return this.prisma.availabilityBlock.upsert({
          where: {
            channelConnectionId_roomTypeId_date: {
              channelConnectionId: connectionId,
              roomTypeId: dto.roomTypeId,
              date,
            },
          },
          update: {
            availableRooms: dto.availableRooms,
            rate: dto.rate,
            isClosed: dto.isClosed ?? false,
            minLOS: dto.minLOS,
            maxLOS: dto.maxLOS,
          },
          create: {
            propertyId,
            channelConnectionId: connectionId,
            roomTypeId: dto.roomTypeId,
            date,
            availableRooms: dto.availableRooms,
            rate: dto.rate,
            isClosed: dto.isClosed ?? false,
            minLOS: dto.minLOS,
            maxLOS: dto.maxLOS,
          },
        });
      }),
    );

    // Create ChannelSyncQueue entry
    const syncEntry = await this.prisma.channelSyncQueue.create({
      data: {
        propertyId,
        syncType: 'availability',
        payload: dto as unknown as Record<string, unknown>,
        status: SyncStatus.PENDING,
      },
    });

    // Enqueue Bull job
    await this.channelSyncQueue.add(
      'sync-availability',
      { syncQueueId: syncEntry.id, connectionId, payload: dto },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return {
      updatedBlocks: upsertResults.length,
      syncQueueId: syncEntry.id,
      status: SyncStatus.PENDING,
    };
  }

  async pushRatesToChannel(
    propertyId: string,
    connectionId: string,
    ratePlanId: string,
    fromDate: string,
    toDate: string,
  ) {
    const connection = await this.prisma.channelConnection.findFirst({
      where: { id: connectionId, propertyId, isActive: true },
    });
    if (!connection) {
      throw new NotFoundException(`Active channel connection ${connectionId} not found`);
    }

    const ratePlan = await this.prisma.ratePlan.findFirst({
      where: { id: ratePlanId, propertyId, isActive: true },
    });
    if (!ratePlan) {
      throw new NotFoundException(`Rate plan ${ratePlanId} not found`);
    }

    // Fetch applicable markup from ChannelRateMapping
    const rateMapping = await this.prisma.channelRateMapping.findFirst({
      where: { channelConnectionId: connectionId, ratePlanId, isActive: true },
    });

    const markupPct = rateMapping ? Number(rateMapping.markup) : 0;
    const baseRate = Number(ratePlan.baseRate);

    // Generate all dates in range
    const dates: string[] = [];
    const cursor = new Date(fromDate);
    const end = new Date(toDate);
    while (cursor <= end) {
      dates.push(cursor.toISOString().split('T')[0]);
      cursor.setDate(cursor.getDate() + 1);
    }

    if (dates.length === 0) {
      throw new BadRequestException('fromDate must be before or equal to toDate');
    }

    const publishedRate = baseRate * (1 + markupPct / 100);

    // Fetch current availability blocks for these dates
    const availabilityBlocks = await this.prisma.availabilityBlock.findMany({
      where: {
        channelConnectionId: connectionId,
        roomTypeId: ratePlan.roomTypeId,
        date: { gte: new Date(fromDate), lte: new Date(toDate) },
      },
    });

    const availMap = new Map(
      availabilityBlocks.map((b) => [b.date.toISOString().split('T')[0], b]),
    );

    const syncEntries = await Promise.all(
      dates.map(async (dateStr) => {
        const avail = availMap.get(dateStr);
        const payload = {
          date: dateStr,
          ratePlanId,
          channelRateCode: rateMapping?.channelRateCode ?? ratePlan.code,
          publishedRate,
          availableRooms: avail?.availableRooms ?? 0,
          isClosed: avail?.isClosed ?? false,
        };

        const entry = await this.prisma.channelSyncQueue.create({
          data: {
            propertyId,
            syncType: 'rates',
            payload: payload as unknown as Record<string, unknown>,
            status: SyncStatus.SUCCESS, // Simulated: in production, status starts PENDING
          },
        });

        this.logger.log(
          `[RATE PUSH SIMULATED] date=${dateStr} rate=${publishedRate} connection=${connectionId}`,
        );

        return entry;
      }),
    );

    // Enqueue push-rates Bull job
    await this.channelSyncQueue.add(
      'push-rates',
      { connectionId, ratePlanId, fromDate, toDate, publishedRate },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return {
      datesProcessed: dates.length,
      publishedRate,
      markup: markupPct,
      syncEntriesCreated: syncEntries.length,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  //  Sync Queue
  // ─────────────────────────────────────────────────────────────────

  async getChannelSyncQueue(
    propertyId: string,
    status?: SyncStatus,
    skip = 0,
    take = 20,
  ) {
    const [items, total] = await Promise.all([
      this.prisma.channelSyncQueue.findMany({
        where: { propertyId, ...(status ? { status } : {}) },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.channelSyncQueue.count({
        where: { propertyId, ...(status ? { status } : {}) },
      }),
    ]);
    return { items, total, skip, take };
  }

  async retryFailedSyncs(propertyId: string) {
    const failedEntries = await this.prisma.channelSyncQueue.findMany({
      where: { propertyId, status: SyncStatus.FAILED },
    });

    if (failedEntries.length === 0) {
      return { retriedCount: 0, message: 'No failed sync entries found' };
    }

    await Promise.all(
      failedEntries.map(async (entry) => {
        await this.prisma.channelSyncQueue.update({
          where: { id: entry.id },
          data: { status: SyncStatus.PENDING, attempts: entry.attempts + 1, lastError: null },
        });

        const jobName = entry.syncType === 'rates' ? 'push-rates' : 'sync-availability';
        await this.channelSyncQueue.add(
          jobName,
          { syncQueueId: entry.id, payload: entry.payload },
          { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
        );
      }),
    );

    return { retriedCount: failedEntries.length };
  }

  // ─────────────────────────────────────────────────────────────────
  //  Availability Calendar
  // ─────────────────────────────────────────────────────────────────

  async getAvailabilityCalendar(
    propertyId: string,
    roomTypeId: string,
    fromDate: string,
    toDate: string,
  ) {
    const roomType = await this.prisma.roomType.findFirst({
      where: { id: roomTypeId, propertyId },
    });
    if (!roomType) throw new NotFoundException(`RoomType ${roomTypeId} not found`);

    const connections = await this.prisma.channelConnection.findMany({
      where: { propertyId, isActive: true },
      select: { id: true, provider: true },
    });

    const blocks = await this.prisma.availabilityBlock.findMany({
      where: {
        propertyId,
        roomTypeId,
        date: { gte: new Date(fromDate), lte: new Date(toDate) },
      },
      include: { channelConnection: { select: { provider: true } } },
      orderBy: { date: 'asc' },
    });

    // Build calendar map: date -> { availableRooms, rate, isClosed, byChannel }
    const calendar: Record<
      string,
      {
        availableRooms: number;
        rate: number;
        isClosed: boolean;
        minLOS?: number;
        maxLOS?: number;
        channels: { provider: string; availableRooms: number; rate: number; isClosed: boolean }[];
      }
    > = {};

    for (const block of blocks) {
      const dateKey = block.date.toISOString().split('T')[0];
      if (!calendar[dateKey]) {
        calendar[dateKey] = {
          availableRooms: block.availableRooms,
          rate: Number(block.rate),
          isClosed: block.isClosed,
          minLOS: block.minLOS ?? undefined,
          maxLOS: block.maxLOS ?? undefined,
          channels: [],
        };
      }
      calendar[dateKey].channels.push({
        provider: block.channelConnection.provider,
        availableRooms: block.availableRooms,
        rate: Number(block.rate),
        isClosed: block.isClosed,
      });
    }

    return {
      roomType: { id: roomType.id, code: roomType.code, name: roomType.name },
      fromDate,
      toDate,
      connectedChannels: connections.map((c) => c.provider),
      calendar,
    };
  }
}
