import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ReservationStatus } from '@prisma/client';
import { KpiQueryDto } from './dto/kpi-query.dto';
import { ReportQueryDto } from './dto/report-query.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────
  //  DAILY KPI SNAPSHOT
  // ─────────────────────────────────────────────────────────

  async getDailyKPI(propertyId: string, date?: string) {
    const target = date ? new Date(date) : new Date();
    target.setHours(0, 0, 0, 0);

    // Prefer a stored snapshot; fall back to computing from night audit
    const stored = await this.prisma.kPISnapshot.findUnique({
      where: {
        propertyId_period_periodDate: {
          propertyId,
          period: 'daily',
          periodDate: target,
        },
      },
    });
    if (stored) return stored;

    // Build from night audit + live reservation data
    const audit = await this.prisma.nightAudit.findUnique({
      where: { propertyId_auditDate: { propertyId, auditDate: target } },
    });

    const targetEnd = new Date(target);
    targetEnd.setHours(23, 59, 59, 999);

    const [totalRooms, arrivals, departures, cancellations, noShows] = await Promise.all([
      this.prisma.room.count({ where: { propertyId, isOOO: false } }),
      this.prisma.reservation.count({
        where: {
          propertyId,
          checkInDate: { gte: target, lte: targetEnd },
          status: { in: [ReservationStatus.CHECKED_IN, ReservationStatus.CHECKED_OUT] },
        },
      }),
      this.prisma.reservation.count({
        where: {
          propertyId,
          checkOutDate: { gte: target, lte: targetEnd },
          status: ReservationStatus.CHECKED_OUT,
        },
      }),
      this.prisma.reservation.count({
        where: {
          propertyId,
          cancelledAt: { gte: target, lte: targetEnd },
          status: ReservationStatus.CANCELLED,
        },
      }),
      this.prisma.reservation.count({
        where: {
          propertyId,
          noShowAt: { gte: target, lte: targetEnd },
          status: ReservationStatus.NO_SHOW,
        },
      }),
    ]);

    // Average length of stay for checkouts today
    const checkoutsToday = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        checkOutDate: { gte: target, lte: targetEnd },
        status: ReservationStatus.CHECKED_OUT,
      },
      select: { checkInDate: true, checkOutDate: true },
    });

    const avgLOS =
      checkoutsToday.length > 0
        ? +(
            checkoutsToday.reduce((sum, r) => {
              const nights = Math.ceil(
                (r.checkOutDate.getTime() - r.checkInDate.getTime()) / (1000 * 60 * 60 * 24),
              );
              return sum + nights;
            }, 0) / checkoutsToday.length
          ).toFixed(2)
        : 0;

    const occupancyPct = audit ? Number(audit.occupancyPct) : 0;
    const adr = audit ? Number(audit.adr) : 0;
    const revpar = audit ? Number(audit.revpar) : 0;
    const totalRevenue = audit ? Number(audit.totalRevenue) : 0;
    const fbRevenue = audit ? Number(audit.fbRevenue) : 0;
    const otherRevenue = audit ? Number(audit.otherRevenue) : 0;
    const roomRevenue = audit ? Number(audit.roomRevenue) : 0;

    // GOPPAR: (roomRevenue + fbRevenue - expenses) / totalRooms
    const expenseAgg = await this.prisma.journalLine.aggregate({
      _sum: { amount: true },
      where: {
        journalEntry: {
          propertyId,
          entryDate: { gte: target, lte: targetEnd },
        },
        account: { type: 'EXPENSE' },
        type: 'DEBIT',
      },
    });
    const totalExpenses = Number(expenseAgg._sum.amount ?? 0);
    const goppar =
      totalRooms > 0
        ? +((roomRevenue + fbRevenue - totalExpenses) / totalRooms).toFixed(2)
        : 0;

    // Upsert the snapshot so future calls are instant
    return this.prisma.kPISnapshot.upsert({
      where: {
        propertyId_period_periodDate: {
          propertyId,
          period: 'daily',
          periodDate: target,
        },
      },
      update: {
        occupancyPct,
        adr,
        revpar,
        goppar,
        totalRevenue,
        fbRevenue,
        otherRevenue,
        totalArrivals: arrivals,
        totalDepartures: departures,
        cancellations,
        noShows,
        avgLOS,
      },
      create: {
        propertyId,
        period: 'daily',
        periodDate: target,
        occupancyPct,
        adr,
        revpar,
        goppar,
        totalRevenue,
        fbRevenue,
        otherRevenue,
        totalArrivals: arrivals,
        totalDepartures: departures,
        cancellations,
        noShows,
        avgLOS,
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  WEEKLY / MONTHLY AGGREGATES
  // ─────────────────────────────────────────────────────────

  async getAggregates(propertyId: string, dto: KpiQueryDto) {
    const { period } = dto;

    const from = dto.fromDate ? new Date(dto.fromDate) : (() => {
      const d = new Date();
      d.setDate(d.getDate() - (period === 'monthly' ? 365 : period === 'weekly' ? 84 : 30));
      d.setHours(0, 0, 0, 0);
      return d;
    })();

    const to = dto.toDate ? new Date(dto.toDate) : new Date();
    to.setHours(23, 59, 59, 999);

    const snapshots = await this.prisma.kPISnapshot.findMany({
      where: {
        propertyId,
        period: 'daily',
        periodDate: { gte: from, lte: to },
      },
      orderBy: { periodDate: 'asc' },
    });

    if (snapshots.length === 0) return { period, from, to, buckets: [] };

    // Bucket daily snapshots into weekly or monthly groups
    type Bucket = {
      label: string;
      days: number;
      occupancySum: number;
      adrSum: number;
      revparSum: number;
      gopparSum: number;
      totalRevenue: number;
      fbRevenue: number;
      otherRevenue: number;
      arrivals: number;
      departures: number;
      cancellations: number;
      noShows: number;
      losSum: number;
    };

    const bucketMap = new Map<string, Bucket>();

    for (const s of snapshots) {
      const d = s.periodDate;
      let key: string;

      if (period === 'weekly') {
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        key = `W-${monday.toISOString().slice(0, 10)}`;
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }

      const existing: Bucket = bucketMap.get(key) ?? {
        label: key,
        days: 0,
        occupancySum: 0,
        adrSum: 0,
        revparSum: 0,
        gopparSum: 0,
        totalRevenue: 0,
        fbRevenue: 0,
        otherRevenue: 0,
        arrivals: 0,
        departures: 0,
        cancellations: 0,
        noShows: 0,
        losSum: 0,
      };

      existing.days += 1;
      existing.occupancySum += Number(s.occupancyPct);
      existing.adrSum += Number(s.adr);
      existing.revparSum += Number(s.revpar);
      existing.gopparSum += Number(s.goppar);
      existing.totalRevenue += Number(s.totalRevenue);
      existing.fbRevenue += Number(s.fbRevenue);
      existing.otherRevenue += Number(s.otherRevenue);
      existing.arrivals += s.totalArrivals;
      existing.departures += s.totalDepartures;
      existing.cancellations += s.cancellations;
      existing.noShows += s.noShows;
      existing.losSum += Number(s.avgLOS);
      bucketMap.set(key, existing);
    }

    const buckets = Array.from(bucketMap.values()).map((b) => ({
      label: b.label,
      days: b.days,
      avgOccupancyPct: +((b.occupancySum / b.days)).toFixed(2),
      avgADR: +((b.adrSum / b.days)).toFixed(2),
      avgRevPAR: +((b.revparSum / b.days)).toFixed(2),
      avgGOPPAR: +((b.gopparSum / b.days)).toFixed(2),
      totalRevenue: +b.totalRevenue.toFixed(2),
      fbRevenue: +b.fbRevenue.toFixed(2),
      otherRevenue: +b.otherRevenue.toFixed(2),
      totalArrivals: b.arrivals,
      totalDepartures: b.departures,
      totalCancellations: b.cancellations,
      totalNoShows: b.noShows,
      avgLOS: +((b.losSum / b.days)).toFixed(2),
    }));

    return { period, from, to, buckets };
  }

  // ─────────────────────────────────────────────────────────
  //  TOP-PERFORMING ROOM TYPES
  // ─────────────────────────────────────────────────────────

  async getTopRoomTypes(
    propertyId: string,
    fromDate: string,
    toDate: string,
    limit = 10,
  ) {
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    // Aggregate reservation revenue by roomTypeId
    const groups = await this.prisma.reservation.groupBy({
      by: ['roomTypeId'],
      where: {
        propertyId,
        status: { in: [ReservationStatus.CHECKED_OUT, ReservationStatus.CHECKED_IN] },
        checkInDate: { gte: from },
        checkOutDate: { lte: to },
        roomTypeId: { not: null },
      },
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: limit,
    });

    if (groups.length === 0) return { fromDate, toDate, topRoomTypes: [] };

    const roomTypeIds = groups.map((g) => g.roomTypeId!).filter(Boolean);
    const roomTypes = await this.prisma.roomType.findMany({
      where: { id: { in: roomTypeIds } },
      select: { id: true, name: true, code: true, baseRate: true },
    });

    const rtMap = new Map(roomTypes.map((rt) => [rt.id, rt]));

    const topRoomTypes = groups.map((g) => {
      const rt = rtMap.get(g.roomTypeId!);
      return {
        roomTypeId: g.roomTypeId,
        roomTypeName: rt?.name ?? 'Unknown',
        roomTypeCode: rt?.code ?? '',
        baseRate: rt ? Number(rt.baseRate) : 0,
        reservationCount: g._count.id,
        totalRevenue: +Number(g._sum.totalAmount ?? 0).toFixed(2),
        avgRevenuePerReservation:
          g._count.id > 0
            ? +(Number(g._sum.totalAmount ?? 0) / g._count.id).toFixed(2)
            : 0,
      };
    });

    return { fromDate, toDate, topRoomTypes };
  }

  // ─────────────────────────────────────────────────────────
  //  REVENUE BY OUTLET
  // ─────────────────────────────────────────────────────────

  async getRevenueByOutlet(propertyId: string, fromDate: string, toDate: string) {
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    const groups = await this.prisma.order.groupBy({
      by: ['outletId'],
      where: {
        propertyId,
        isVoid: false,
        createdAt: { gte: from, lte: to },
      },
      _sum: { total: true, subtotal: true, taxAmount: true },
      _count: { id: true },
      orderBy: { _sum: { total: 'desc' } },
    });

    if (groups.length === 0) return { fromDate, toDate, outlets: [] };

    const outletIds = groups.map((g) => g.outletId);
    const outlets = await this.prisma.outlet.findMany({
      where: { id: { in: outletIds } },
      select: { id: true, name: true, type: true },
    });

    const outletMap = new Map(outlets.map((o) => [o.id, o]));

    const result = groups.map((g) => {
      const outlet = outletMap.get(g.outletId);
      return {
        outletId: g.outletId,
        outletName: outlet?.name ?? 'Unknown',
        outletType: outlet?.type ?? '',
        orderCount: g._count.id,
        subtotal: +Number(g._sum.subtotal ?? 0).toFixed(2),
        taxAmount: +Number(g._sum.taxAmount ?? 0).toFixed(2),
        totalRevenue: +Number(g._sum.total ?? 0).toFixed(2),
      };
    });

    const grandTotal = +result.reduce((s, o) => s + o.totalRevenue, 0).toFixed(2);

    return { fromDate, toDate, grandTotal, outlets: result };
  }

  // ─────────────────────────────────────────────────────────
  //  REPORTS — store and retrieve
  // ─────────────────────────────────────────────────────────

  async generateReport(propertyId: string, dto: ReportQueryDto, createdById: string) {
    const from = new Date(dto.fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(dto.toDate);
    to.setHours(23, 59, 59, 999);

    if (to < from) throw new BadRequestException('toDate must be after fromDate');

    let data: any = {};

    if (dto.type === 'occupancy' || dto.type === 'combined') {
      const audits = await this.prisma.nightAudit.findMany({
        where: { propertyId, auditDate: { gte: from, lte: to } },
        orderBy: { auditDate: 'asc' },
      });
      data.occupancy = audits.map((a) => ({
        date: a.auditDate.toISOString().slice(0, 10),
        totalRooms: a.totalRooms,
        occupiedRooms: a.occupiedRooms,
        occupancyPct: Number(a.occupancyPct),
        adr: Number(a.adr),
        revpar: Number(a.revpar),
      }));
    }

    if (dto.type === 'revenue' || dto.type === 'combined') {
      const snapshots = await this.prisma.revenueSnapshot.findMany({
        where: { propertyId, snapshotDate: { gte: from, lte: to } },
        orderBy: { snapshotDate: 'asc' },
      });
      data.revenue = snapshots.map((s) => ({
        date: s.snapshotDate.toISOString().slice(0, 10),
        totalRevenue: Number(s.totalRevenue),
        roomRevenue: Number(s.roomRevenue),
        fbRevenue: Number(s.fbRevenue),
        otherRevenue: Number(s.otherRevenue),
        goppar: Number(s.goppar),
      }));
    }

    if (dto.type === 'pos') {
      const [topItems, outletRevenue] = await Promise.all([
        this.prisma.orderItem.groupBy({
          by: ['menuItemId'],
          where: {
            order: {
              propertyId,
              isVoid: false,
              createdAt: { gte: from, lte: to },
            },
          },
          _sum: { quantity: true, totalPrice: true },
          _count: { id: true },
          orderBy: { _sum: { totalPrice: 'desc' } },
          take: 20,
        }),
        this.getRevenueByOutlet(propertyId, dto.fromDate, dto.toDate),
      ]);

      const menuItemIds = topItems.map((i) => i.menuItemId);
      const menuItems = await this.prisma.menuItem.findMany({
        where: { id: { in: menuItemIds } },
        select: { id: true, name: true, category: true },
      });
      const miMap = new Map(menuItems.map((m) => [m.id, m]));

      data.pos = {
        topItems: topItems.map((i) => ({
          menuItemId: i.menuItemId,
          name: miMap.get(i.menuItemId)?.name ?? 'Unknown',
          category: miMap.get(i.menuItemId)?.category ?? '',
          quantitySold: Number(i._sum.quantity ?? 0),
          totalRevenue: +Number(i._sum.totalPrice ?? 0).toFixed(2),
        })),
        outletRevenue: outletRevenue.outlets,
      };
    }

    // Persist the report
    const report = await this.prisma.report.create({
      data: {
        propertyId,
        name: `${dto.type.toUpperCase()} Report — ${dto.fromDate} to ${dto.toDate}`,
        type: dto.type,
        period: dto.period ?? 'daily',
        fromDate: from,
        toDate: to,
        data,
        createdById,
      },
    });

    return report;
  }

  async listReports(
    propertyId: string,
    params: { type?: string; skip?: number; take?: number },
  ) {
    const { type, skip = 0, take = 20 } = params;

    const where: any = { propertyId };
    if (type) where.type = type;

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.report.count({ where }),
    ]);

    return { reports, total, skip, take };
  }

  async getReport(propertyId: string, id: string) {
    const report = await this.prisma.report.findFirst({ where: { id, propertyId } });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  // ─────────────────────────────────────────────────────────
  //  CSV EXPORT
  // ─────────────────────────────────────────────────────────

  async exportKpiCsv(propertyId: string, fromDate: string, toDate: string): Promise<string> {
    const from = new Date(fromDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    const snapshots = await this.prisma.kPISnapshot.findMany({
      where: {
        propertyId,
        period: 'daily',
        periodDate: { gte: from, lte: to },
      },
      orderBy: { periodDate: 'asc' },
    });

    const header = [
      'date',
      'occupancy_pct',
      'adr',
      'revpar',
      'goppar',
      'total_revenue',
      'fb_revenue',
      'other_revenue',
      'arrivals',
      'departures',
      'cancellations',
      'no_shows',
      'avg_los',
    ].join(',');

    const rows = snapshots.map((s) =>
      [
        s.periodDate.toISOString().slice(0, 10),
        Number(s.occupancyPct),
        Number(s.adr),
        Number(s.revpar),
        Number(s.goppar),
        Number(s.totalRevenue),
        Number(s.fbRevenue),
        Number(s.otherRevenue),
        s.totalArrivals,
        s.totalDepartures,
        s.cancellations,
        s.noShows,
        Number(s.avgLOS),
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  async exportRevenueByOutletCsv(propertyId: string, fromDate: string, toDate: string): Promise<string> {
    const result = await this.getRevenueByOutlet(propertyId, fromDate, toDate);

    const header = ['outlet_id', 'outlet_name', 'outlet_type', 'order_count', 'subtotal', 'tax_amount', 'total_revenue'].join(',');

    const rows = result.outlets.map((o) =>
      [
        o.outletId,
        `"${o.outletName.replace(/"/g, '""')}"`,
        o.outletType,
        o.orderCount,
        o.subtotal,
        o.taxAmount,
        o.totalRevenue,
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }
}
