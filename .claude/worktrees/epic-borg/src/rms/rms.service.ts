import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreatePricingRuleDto } from './dto/create-pricing-rule.dto';
import { GenerateForecastDto } from './dto/generate-forecast.dto';

@Injectable()
export class RmsService {
  private readonly logger = new Logger(RmsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────
  //  Pricing Rules
  // ─────────────────────────────────────────────────────────────────

  async createPricingRule(propertyId: string, dto: CreatePricingRuleDto) {
    return this.prisma.pricingRule.create({
      data: {
        propertyId,
        name: dto.name,
        type: dto.type,
        roomTypeId: dto.roomTypeId,
        triggerMetric: dto.triggerMetric,
        triggerValue: dto.triggerValue,
        adjustmentType: dto.adjustmentType,
        adjustmentValue: dto.adjustmentValue,
        minRate: dto.minRate,
        maxRate: dto.maxRate,
        priority: dto.priority ?? 10,
        isActive: dto.isActive ?? true,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        daysOfWeek: dto.daysOfWeek ?? [],
      },
    });
  }

  async listPricingRules(propertyId: string, isActive?: boolean) {
    return this.prisma.pricingRule.findMany({
      where: {
        propertyId,
        ...(isActive !== undefined ? { isActive } : {}),
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async updatePricingRule(propertyId: string, id: string, dto: Partial<CreatePricingRuleDto>) {
    const rule = await this.prisma.pricingRule.findFirst({ where: { id, propertyId } });
    if (!rule) throw new NotFoundException(`Pricing rule ${id} not found`);

    return this.prisma.pricingRule.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.type && { type: dto.type }),
        ...(dto.roomTypeId !== undefined && { roomTypeId: dto.roomTypeId }),
        ...(dto.triggerMetric !== undefined && { triggerMetric: dto.triggerMetric }),
        ...(dto.triggerValue !== undefined && { triggerValue: dto.triggerValue }),
        ...(dto.adjustmentType && { adjustmentType: dto.adjustmentType }),
        ...(dto.adjustmentValue !== undefined && { adjustmentValue: dto.adjustmentValue }),
        ...(dto.minRate !== undefined && { minRate: dto.minRate }),
        ...(dto.maxRate !== undefined && { maxRate: dto.maxRate }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.validFrom !== undefined && { validFrom: dto.validFrom ? new Date(dto.validFrom) : null }),
        ...(dto.validUntil !== undefined && { validUntil: dto.validUntil ? new Date(dto.validUntil) : null }),
        ...(dto.daysOfWeek !== undefined && { daysOfWeek: dto.daysOfWeek }),
      },
    });
  }

  async deletePricingRule(propertyId: string, id: string) {
    const rule = await this.prisma.pricingRule.findFirst({ where: { id, propertyId } });
    if (!rule) throw new NotFoundException(`Pricing rule ${id} not found`);

    return this.prisma.pricingRule.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  //  Rate Recommendation Engine
  // ─────────────────────────────────────────────────────────────────

  async calculateRecommendedRate(
    propertyId: string,
    roomTypeId: string,
    date: string,
  ): Promise<{
    baseRate: number;
    recommendedRate: number;
    appliedRules: { id: string; name: string; type: string; adjustment: number }[];
    occupancyPct: number;
  }> {
    const roomType = await this.prisma.roomType.findFirst({
      where: { id: roomTypeId, propertyId },
    });
    if (!roomType) throw new NotFoundException(`RoomType ${roomTypeId} not found`);

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay(); // 0=Sun, 6=Sat

    const totalRoomsForType = await this.prisma.room.count({
      where: { propertyId, roomTypeId, isOOO: false },
    });

    const occupiedCount = await this.prisma.reservation.count({
      where: {
        propertyId,
        checkInDate: { lte: targetDate },
        checkOutDate: { gt: targetDate },
        status: { in: ['CONFIRMED', 'CHECKED_IN'] },
      },
    });

    const occupancyPct =
      totalRoomsForType > 0 ? (occupiedCount / totalRoomsForType) * 100 : 0;

    const rules = await this.prisma.pricingRule.findMany({
      where: {
        propertyId,
        isActive: true,
        OR: [{ roomTypeId: null }, { roomTypeId }],
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: targetDate } }] },
          { OR: [{ validUntil: null }, { validUntil: { gte: targetDate } }] },
        ],
      },
      orderBy: { priority: 'asc' },
    });

    let rate = Number(roomType.baseRate);
    const baseRate = rate;
    const appliedRules: { id: string; name: string; type: string; adjustment: number }[] = [];

    for (const rule of rules) {
      if (rule.daysOfWeek.length > 0 && !rule.daysOfWeek.includes(dayOfWeek)) {
        continue;
      }

      if (rule.triggerMetric === 'occupancy_pct' && rule.triggerValue !== null) {
        if (occupancyPct < Number(rule.triggerValue)) continue;
      }

      let adjustment = 0;
      if (rule.adjustmentType === 'percentage') {
        adjustment = rate * (Number(rule.adjustmentValue) / 100);
        rate = rate * (1 + Number(rule.adjustmentValue) / 100);
      } else if (rule.adjustmentType === 'fixed') {
        adjustment = Number(rule.adjustmentValue);
        rate = rate + Number(rule.adjustmentValue);
      }

      if (rule.minRate !== null && rate < Number(rule.minRate)) rate = Number(rule.minRate);
      if (rule.maxRate !== null && rate > Number(rule.maxRate)) rate = Number(rule.maxRate);

      appliedRules.push({
        id: rule.id,
        name: rule.name,
        type: rule.adjustmentType,
        adjustment,
      });
    }

    return {
      baseRate,
      recommendedRate: Math.round(rate * 100) / 100,
      appliedRules,
      occupancyPct: Math.round(occupancyPct * 100) / 100,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  //  Forecast Generation
  // ─────────────────────────────────────────────────────────────────

  async generateForecast(propertyId: string, dto: GenerateForecastDto) {
    const roomTypes = dto.roomTypeId
      ? await this.prisma.roomType.findMany({ where: { id: dto.roomTypeId, propertyId } })
      : await this.prisma.roomType.findMany({ where: { propertyId, isActive: true } });

    if (roomTypes.length === 0) throw new NotFoundException('No active room types found');

    const dates: string[] = [];
    const cursor = new Date(dto.fromDate);
    const end = new Date(dto.toDate);
    while (cursor <= end) {
      dates.push(cursor.toISOString().split('T')[0]);
      cursor.setDate(cursor.getDate() + 1);
    }

    const forecasts = [];

    for (const roomType of roomTypes) {
      for (const dateStr of dates) {
        const targetDate = new Date(dateStr);

        const { recommendedRate, occupancyPct } = await this.calculateRecommendedRate(
          propertyId,
          roomType.id,
          dateStr,
        );

        // Historical occupancy: average of last 4 same day-of-week occurrences
        const historicalDates: Date[] = [];
        for (let w = 1; w <= 4; w++) {
          const histDate = new Date(targetDate);
          histDate.setDate(histDate.getDate() - w * 7);
          historicalDates.push(histDate);
        }

        const historicalOccupancies = await Promise.all(
          historicalDates.map(async (hDate) => {
            const [occupied, total] = await Promise.all([
              this.prisma.reservation.count({
                where: {
                  propertyId,
                  checkInDate: { lte: hDate },
                  checkOutDate: { gt: hDate },
                  status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
                },
              }),
              this.prisma.room.count({
                where: { propertyId, roomTypeId: roomType.id, isOOO: false },
              }),
            ]);
            return total > 0 ? (occupied / total) * 100 : 0;
          }),
        );

        const avgHistoricalOccupancy =
          historicalOccupancies.length > 0
            ? historicalOccupancies.reduce((a, b) => a + b, 0) / historicalOccupancies.length
            : occupancyPct;

        const predictedOccupancy = Math.min(
          Math.round(avgHistoricalOccupancy * 100) / 100,
          100,
        );
        const predictedADR = recommendedRate;
        const predictedRevPAR = (predictedADR * predictedOccupancy) / 100;

        const forecast = await this.prisma.rateForecast.upsert({
          where: {
            propertyId_forecastDate_roomTypeId: {
              propertyId,
              forecastDate: targetDate,
              roomTypeId: roomType.id,
            },
          },
          update: {
            predictedOccupancy,
            predictedADR,
            predictedRevPAR,
            recommendedRate,
            confidenceScore: 70,
            modelVersion: '1.0.0',
          },
          create: {
            propertyId,
            forecastDate: targetDate,
            roomTypeId: roomType.id,
            predictedOccupancy,
            predictedADR,
            predictedRevPAR,
            recommendedRate,
            confidenceScore: 70,
            modelVersion: '1.0.0',
          },
        });

        forecasts.push(forecast);
      }
    }

    return forecasts;
  }

  // ─────────────────────────────────────────────────────────────────
  //  Revenue Snapshots
  // ─────────────────────────────────────────────────────────────────

  async captureRevenueSnapshot(propertyId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const audit = await this.prisma.nightAudit.findUnique({
      where: { propertyId_auditDate: { propertyId, auditDate: targetDate } },
    });

    const [totalRooms, outOfOrderRooms] = await Promise.all([
      this.prisma.room.count({ where: { propertyId } }),
      this.prisma.room.count({ where: { propertyId, isOOO: true } }),
    ]);

    const occupiedRooms = audit?.occupiedRooms ?? 0;
    const occupancyPct =
      totalRooms > 0 ? Math.round(((occupiedRooms / totalRooms) * 100) * 100) / 100 : 0;
    const roomRevenue = audit ? Number(audit.roomRevenue) : 0;
    const fbRevenue = audit ? Number(audit.fbRevenue) : 0;
    const otherRevenue = audit ? Number(audit.otherRevenue) : 0;
    const totalRevenue = audit ? Number(audit.totalRevenue) : 0;
    const adr = audit ? Number(audit.adr) : 0;
    const revpar = audit ? Number(audit.revpar) : 0;

    const expenseLines = await this.prisma.journalLine.aggregate({
      _sum: { amount: true },
      where: {
        journalEntry: {
          propertyId,
          entryDate: {
            gte: targetDate,
            lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        account: { type: 'EXPENSE' },
        type: 'DEBIT',
      },
    });

    const totalExpenses = Number(expenseLines._sum.amount ?? 0);
    const gopAmount = roomRevenue + fbRevenue - totalExpenses;
    const goppar = totalRooms > 0 ? gopAmount / totalRooms : 0;

    return this.prisma.revenueSnapshot.upsert({
      where: { propertyId_snapshotDate: { propertyId, snapshotDate: targetDate } },
      update: {
        totalRooms,
        occupiedRooms,
        outOfOrderRooms,
        occupancyPct,
        adr,
        revpar,
        goppar,
        totalRevenue,
        roomRevenue,
        fbRevenue,
        otherRevenue,
        totalExpenses,
        gopAmount,
      },
      create: {
        propertyId,
        snapshotDate: targetDate,
        totalRooms,
        occupiedRooms,
        outOfOrderRooms,
        occupancyPct,
        adr,
        revpar,
        goppar,
        totalRevenue,
        roomRevenue,
        fbRevenue,
        otherRevenue,
        totalExpenses,
        gopAmount,
      },
    });
  }

  async getRevenueSnapshots(propertyId: string, fromDate: string, toDate: string) {
    return this.prisma.revenueSnapshot.findMany({
      where: {
        propertyId,
        snapshotDate: { gte: new Date(fromDate), lte: new Date(toDate) },
      },
      orderBy: { snapshotDate: 'asc' },
    });
  }

  async getRevenueKPIs(
    propertyId: string,
    period: 'daily' | 'weekly' | 'monthly',
    fromDate: string,
    toDate: string,
  ) {
    const snapshots = await this.prisma.revenueSnapshot.findMany({
      where: {
        propertyId,
        snapshotDate: { gte: new Date(fromDate), lte: new Date(toDate) },
      },
      orderBy: { snapshotDate: 'asc' },
    });

    if (snapshots.length === 0) return [];

    const buckets = new Map<
      string,
      {
        occupancyTotal: number;
        adrTotal: number;
        revparTotal: number;
        gopparTotal: number;
        revenueTotal: number;
        count: number;
      }
    >();

    for (const s of snapshots) {
      const d = s.snapshotDate;
      let key: string;

      if (period === 'daily') {
        key = d.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        key = `W-${monday.toISOString().split('T')[0]}`;
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }

      const existing = buckets.get(key) ?? {
        occupancyTotal: 0,
        adrTotal: 0,
        revparTotal: 0,
        gopparTotal: 0,
        revenueTotal: 0,
        count: 0,
      };

      existing.occupancyTotal += Number(s.occupancyPct);
      existing.adrTotal += Number(s.adr);
      existing.revparTotal += Number(s.revpar);
      existing.gopparTotal += Number(s.goppar);
      existing.revenueTotal += Number(s.totalRevenue);
      existing.count += 1;
      buckets.set(key, existing);
    }

    return Array.from(buckets.entries()).map(([label, b]) => ({
      periodLabel: label,
      occupancyPct: Math.round((b.occupancyTotal / b.count) * 100) / 100,
      adr: Math.round((b.adrTotal / b.count) * 100) / 100,
      revpar: Math.round((b.revparTotal / b.count) * 100) / 100,
      goppar: Math.round((b.gopparTotal / b.count) * 100) / 100,
      totalRevenue: Math.round(b.revenueTotal * 100) / 100,
    }));
  }

  async getForecasts(
    propertyId: string,
    fromDate: string,
    toDate: string,
    roomTypeId?: string,
  ) {
    return this.prisma.rateForecast.findMany({
      where: {
        propertyId,
        forecastDate: { gte: new Date(fromDate), lte: new Date(toDate) },
        ...(roomTypeId ? { roomTypeId } : {}),
      },
      orderBy: { forecastDate: 'asc' },
    });
  }

  async getRateRecommendations(propertyId: string, fromDate: string, toDate: string) {
    const roomTypes = await this.prisma.roomType.findMany({
      where: { propertyId, isActive: true },
    });

    const dates: string[] = [];
    const cursor = new Date(fromDate);
    const end = new Date(toDate);
    while (cursor <= end) {
      dates.push(cursor.toISOString().split('T')[0]);
      cursor.setDate(cursor.getDate() + 1);
    }

    const recommendations: {
      roomTypeId: string;
      roomTypeName: string;
      date: string;
      currentBaseRate: number;
      recommendedRate: number;
      variancePct: number;
      occupancyPct: number;
      appliedRules: { id: string; name: string; type: string; adjustment: number }[];
    }[] = [];

    for (const roomType of roomTypes) {
      const currentBaseRate = Number(roomType.baseRate);

      for (const dateStr of dates) {
        const { recommendedRate, appliedRules, occupancyPct } =
          await this.calculateRecommendedRate(propertyId, roomType.id, dateStr);

        const variancePct =
          currentBaseRate > 0
            ? Math.round(((recommendedRate - currentBaseRate) / currentBaseRate) * 10000) / 100
            : 0;

        recommendations.push({
          roomTypeId: roomType.id,
          roomTypeName: roomType.name,
          date: dateStr,
          currentBaseRate,
          recommendedRate,
          variancePct,
          occupancyPct,
          appliedRules,
        });
      }
    }

    return recommendations;
  }
}
