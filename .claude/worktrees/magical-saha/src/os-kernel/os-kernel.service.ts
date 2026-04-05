import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AutomationLevel, TaskStatus } from '@prisma/client';
import { PublishEventDto } from './dto/publish-event.dto';
import { CreateAutomationTaskDto } from './dto/create-automation-task.dto';

// ─────────────────────────────────────────────────────────────────────────────
//  HARD AI LIMITS — tasks that are ALWAYS BLOCKED, regardless of level
//  These represent actions that must NEVER be performed autonomously.
// ─────────────────────────────────────────────────────────────────────────────
const HARD_BLOCKED_ACTIONS = [
  'walk-guest',               // evicting a guest without human authorisation
  'issue-key-no-id',          // issuing a room key without ID verification
  'charge-without-consent',   // applying charges not agreed by the guest
  'modify-audit-trail',       // any alteration to immutable audit records
  'initiate-emergency-services', // calling emergency services autonomously
  'blacklist-guest',          // blacklisting a guest without manual review
] as const;

type BlockedAction = (typeof HARD_BLOCKED_ACTIONS)[number];

@Injectable()
export class OsKernelService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────
  //  EVENT BUS
  // ─────────────────────────────────────────────────────────

  async publishEvent(propertyId: string, dto: PublishEventDto) {
    return this.prisma.eventLog.create({
      data: {
        propertyId,
        eventType: dto.eventType,
        entityType: dto.entityType,
        entityId: dto.entityId,
        payload: dto.payload,
        publishedBy: dto.publishedBy ?? null,
        processedBy: [],
      },
    });
  }

  async listEvents(
    propertyId: string,
    params: {
      eventType?: string;
      entityType?: string;
      entityId?: string;
      skip?: number;
      take?: number;
    },
  ) {
    const { eventType, entityType, entityId, skip = 0, take = 50 } = params;

    const where: any = { propertyId };
    if (eventType) where.eventType = eventType;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    const [events, total] = await Promise.all([
      this.prisma.eventLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.eventLog.count({ where }),
    ]);

    return { events, total, skip, take };
  }

  async getEvent(propertyId: string, id: string) {
    const event = await this.prisma.eventLog.findFirst({
      where: { id, propertyId },
    });
    if (!event) throw new NotFoundException('Event log not found');
    return event;
  }

  async acknowledgeEvent(propertyId: string, id: string, handlerId: string) {
    const event = await this.prisma.eventLog.findFirst({
      where: { id, propertyId },
    });
    if (!event) throw new NotFoundException('Event log not found');

    if (event.processedBy.includes(handlerId)) {
      throw new BadRequestException('Handler has already acknowledged this event');
    }

    return this.prisma.eventLog.update({
      where: { id },
      data: { processedBy: { push: handlerId } },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  AUTOMATION TASK QUEUE
  // ─────────────────────────────────────────────────────────

  async createAutomationTask(propertyId: string, dto: CreateAutomationTaskDto) {
    // Enforce hard AI limits: check payload for blocked actions
    const actionHint: string = (dto.payload?.action ?? dto.name ?? '').toLowerCase();
    const blocked = HARD_BLOCKED_ACTIONS.find((a) => actionHint.includes(a));

    if (blocked) {
      // Record the attempt in the event log and reject
      await this.prisma.eventLog.create({
        data: {
          propertyId,
          eventType: 'ai.boundary.violation',
          entityType: 'automation_task',
          entityId: 'N/A',
          payload: {
            blockedAction: blocked,
            taskName: dto.name,
            triggerEvent: dto.triggerEvent,
            reason: 'Hard AI limit enforced by OsKernel',
          },
        },
      });

      throw new BadRequestException(
        `HARD LIMIT: Task action '${blocked}' is permanently blocked. This action requires authorised human intervention.`,
      );
    }

    // L4 tasks that include sensitive keywords require human review flag
    const requiresHuman =
      dto.automationLevel === AutomationLevel.L4
        ? false
        : dto.automationLevel === AutomationLevel.L0 ||
          dto.automationLevel === AutomationLevel.L1;

    return this.prisma.automationTask.create({
      data: {
        propertyId,
        name: dto.name,
        description: dto.description,
        triggerEvent: dto.triggerEvent,
        automationLevel: dto.automationLevel,
        status: TaskStatus.PENDING,
        payload: dto.payload,
        maxAttempts: dto.maxAttempts ?? 3,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        requiresHuman,
      },
    });
  }

  async processNextTask(propertyId: string) {
    // Dequeue oldest PENDING task that is not blocked and not requiring human approval
    const task = await this.prisma.automationTask.findFirst({
      where: {
        propertyId,
        status: TaskStatus.PENDING,
        isBlocked: false,
        requiresHuman: false,
        OR: [
          { scheduledAt: null },
          { scheduledAt: { lte: new Date() } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!task) {
      return { message: 'No pending tasks ready for processing' };
    }

    // Mark as running
    const running = await this.prisma.automationTask.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.RUNNING,
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    return { task: running, message: 'Task picked up for processing' };
  }

  async completeTask(
    propertyId: string,
    id: string,
    result: Record<string, any>,
  ) {
    const task = await this.prisma.automationTask.findFirst({
      where: { id, propertyId },
    });
    if (!task) throw new NotFoundException('Automation task not found');

    if (task.status !== TaskStatus.RUNNING) {
      throw new BadRequestException(
        `Cannot complete a task with status '${task.status}'`,
      );
    }

    return this.prisma.automationTask.update({
      where: { id },
      data: {
        status: TaskStatus.COMPLETED,
        result,
        completedAt: new Date(),
      },
    });
  }

  async failTask(propertyId: string, id: string, errorMessage: string) {
    const task = await this.prisma.automationTask.findFirst({
      where: { id, propertyId },
    });
    if (!task) throw new NotFoundException('Automation task not found');

    const exhausted = task.attempts >= task.maxAttempts;

    return this.prisma.automationTask.update({
      where: { id },
      data: {
        status: exhausted ? TaskStatus.FAILED : TaskStatus.PENDING,
        errorMessage,
        ...(exhausted && { isBlocked: true, blockedReason: 'Max attempts exceeded' }),
      },
    });
  }

  async approveTask(
    propertyId: string,
    id: string,
    approvedById: string,
  ) {
    const task = await this.prisma.automationTask.findFirst({
      where: { id, propertyId },
    });
    if (!task) throw new NotFoundException('Automation task not found');

    if (!task.requiresHuman) {
      throw new BadRequestException('This task does not require human approval');
    }

    return this.prisma.automationTask.update({
      where: { id },
      data: {
        requiresHuman: false,
        humanApprovedBy: approvedById,
        humanApprovedAt: new Date(),
        status: TaskStatus.PENDING,
      },
    });
  }

  async getTaskStatus(propertyId: string, id: string) {
    const task = await this.prisma.automationTask.findFirst({
      where: { id, propertyId },
    });
    if (!task) throw new NotFoundException('Automation task not found');
    return task;
  }

  async listTasks(
    propertyId: string,
    params: {
      status?: TaskStatus;
      automationLevel?: AutomationLevel;
      skip?: number;
      take?: number;
    },
  ) {
    const { status, automationLevel, skip = 0, take = 20 } = params;

    const where: any = { propertyId };
    if (status) where.status = status;
    if (automationLevel) where.automationLevel = automationLevel;

    const [tasks, total] = await Promise.all([
      this.prisma.automationTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.automationTask.count({ where }),
    ]);

    return { tasks, total, skip, take };
  }

  // ─────────────────────────────────────────────────────────
  //  AI BOUNDARY ENFORCEMENT LOG
  // ─────────────────────────────────────────────────────────

  async getAiBoundaryViolations(
    propertyId: string,
    skip = 0,
    take = 20,
  ) {
    const [violations, total] = await Promise.all([
      this.prisma.eventLog.findMany({
        where: { propertyId, eventType: 'ai.boundary.violation' },
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.eventLog.count({
        where: { propertyId, eventType: 'ai.boundary.violation' },
      }),
    ]);

    return { violations, total, skip, take };
  }
}
