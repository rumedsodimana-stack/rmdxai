import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { MessageStatus, NotificationChannel } from '@prisma/client';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class CommsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────
  //  MESSAGES
  // ─────────────────────────────────────────────────────────

  async sendMessage(propertyId: string, senderId: string, dto: SendMessageDto) {
    // Verify sender belongs to the property
    const sender = await this.prisma.user.findFirst({
      where: { id: senderId, propertyId },
    });
    if (!sender) throw new NotFoundException('Sender not found on this property');

    // If replying, verify parent exists on the same property
    if (dto.parentId) {
      const parent = await this.prisma.message.findFirst({
        where: { id: dto.parentId, propertyId },
      });
      if (!parent) throw new NotFoundException('Parent message not found');
    }

    return this.prisma.message.create({
      data: {
        propertyId,
        senderId,
        recipientIds: dto.recipientIds,
        subject: dto.subject,
        body: dto.body,
        priority: dto.priority ?? 'normal',
        status: MessageStatus.SENT,
        parentId: dto.parentId,
      },
    });
  }

  async getThread(propertyId: string, messageId: string) {
    const root = await this.prisma.message.findFirst({
      where: { id: messageId, propertyId },
    });
    if (!root) throw new NotFoundException('Message not found');

    // Return root + all replies
    const replies = await this.prisma.message.findMany({
      where: { propertyId, parentId: messageId },
      orderBy: { createdAt: 'asc' },
    });

    return { root, replies };
  }

  async getMessagesForUser(
    propertyId: string,
    userId: string,
    skip = 0,
    take = 20,
  ) {
    // Messages where user is sender or recipient
    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: {
          propertyId,
          OR: [
            { senderId: userId },
            { recipientIds: { has: userId } },
          ],
          parentId: null, // top-level threads only
        },
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.message.count({
        where: {
          propertyId,
          OR: [
            { senderId: userId },
            { recipientIds: { has: userId } },
          ],
          parentId: null,
        },
      }),
    ]);

    return { messages, total, skip, take };
  }

  async markMessageRead(propertyId: string, messageId: string, userId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, propertyId },
    });
    if (!message) throw new NotFoundException('Message not found');

    if (!message.recipientIds.includes(userId)) {
      throw new BadRequestException('User is not a recipient of this message');
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: { status: MessageStatus.READ },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  ANNOUNCEMENTS
  // ─────────────────────────────────────────────────────────

  async createAnnouncement(
    propertyId: string,
    authorId: string,
    dto: CreateAnnouncementDto,
  ) {
    return this.prisma.announcement.create({
      data: {
        propertyId,
        authorId,
        title: dto.title,
        body: dto.body,
        targetRoles: dto.targetRoles ?? [],
        targetDepts: dto.targetDepts ?? [],
        isPinned: dto.isPinned ?? false,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }

  async listAnnouncements(
    propertyId: string,
    params: { department?: string; skip?: number; take?: number },
  ) {
    const { department, skip = 0, take = 20 } = params;

    const now = new Date();
    const where: any = {
      propertyId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: now } },
      ],
    };

    if (department) {
      where.OR = [
        ...(where.OR ?? []),
        { targetDepts: { has: department } },
      ];
    }

    const [announcements, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.announcement.count({ where }),
    ]);

    return { announcements, total, skip, take };
  }

  async getAnnouncement(propertyId: string, id: string) {
    const announcement = await this.prisma.announcement.findFirst({
      where: { id, propertyId },
    });
    if (!announcement) throw new NotFoundException('Announcement not found');
    return announcement;
  }

  async updateAnnouncement(
    propertyId: string,
    id: string,
    dto: Partial<CreateAnnouncementDto>,
  ) {
    const announcement = await this.prisma.announcement.findFirst({
      where: { id, propertyId },
    });
    if (!announcement) throw new NotFoundException('Announcement not found');

    return this.prisma.announcement.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.body && { body: dto.body }),
        ...(dto.targetRoles !== undefined && { targetRoles: dto.targetRoles }),
        ...(dto.targetDepts !== undefined && { targetDepts: dto.targetDepts }),
        ...(dto.isPinned !== undefined && { isPinned: dto.isPinned }),
        ...(dto.expiresAt !== undefined && { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }),
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  NOTIFICATION DELIVERY LOG
  // ─────────────────────────────────────────────────────────

  async logNotification(
    propertyId: string,
    recipientId: string,
    channel: NotificationChannel,
    subject: string | undefined,
    body: string,
    referenceType?: string,
    referenceId?: string,
  ) {
    return this.prisma.notificationLog.create({
      data: {
        propertyId,
        recipientId,
        channel,
        subject,
        body,
        isDelivered: false,
        referenceType,
        referenceId,
      },
    });
  }

  async markNotificationDelivered(propertyId: string, id: string) {
    const log = await this.prisma.notificationLog.findFirst({
      where: { id, propertyId },
    });
    if (!log) throw new NotFoundException('Notification log not found');

    return this.prisma.notificationLog.update({
      where: { id },
      data: { isDelivered: true, deliveredAt: new Date() },
    });
  }

  async getNotificationLogs(
    propertyId: string,
    recipientId?: string,
    skip = 0,
    take = 20,
  ) {
    const where: any = { propertyId };
    if (recipientId) where.recipientId = recipientId;

    const [logs, total] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.notificationLog.count({ where }),
    ]);

    return { logs, total, skip, take };
  }
}
