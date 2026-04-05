import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { OrderStatus, BillStatus, PaymentMethod } from '@prisma/client';

import { CreateOutletDto } from './dto/create-outlet.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { SettleBillDto } from './dto/settle-bill.dto';

const SERVICE_CHARGE_RATE = 0.10; // 10%

@Injectable()
export class PosService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────
  //  OUTLETS
  // ─────────────────────────────────────────────────────────

  async createOutlet(propertyId: string, dto: CreateOutletDto) {
    return this.prisma.outlet.create({
      data: {
        propertyId,
        name: dto.name,
        type: dto.type,
        location: dto.location,
        openTime: dto.openTime,
        closeTime: dto.closeTime,
      },
    });
  }

  async listOutlets(propertyId: string) {
    return this.prisma.outlet.findMany({
      where: { propertyId, isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { menuItems: true, orders: true } } },
    });
  }

  async updateOutlet(propertyId: string, id: string, dto: Partial<CreateOutletDto>) {
    const outlet = await this.prisma.outlet.findFirst({ where: { id, propertyId } });
    if (!outlet) throw new NotFoundException('Outlet not found');

    return this.prisma.outlet.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.type && { type: dto.type }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.openTime !== undefined && { openTime: dto.openTime }),
        ...(dto.closeTime !== undefined && { closeTime: dto.closeTime }),
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  MENU ITEMS
  // ─────────────────────────────────────────────────────────

  async getMenuItems(propertyId: string, outletId?: string, category?: string) {
    return this.prisma.menuItem.findMany({
      where: {
        propertyId,
        isAvailable: true,
        ...(outletId && { outletId }),
        ...(category && { category }),
      },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: { outlet: { select: { id: true, name: true, type: true } } },
    });
  }

  async createMenuItem(propertyId: string, dto: CreateMenuItemDto) {
    // Ensure the outlet belongs to this property
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: dto.outletId, propertyId },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');

    return this.prisma.menuItem.create({
      data: {
        propertyId,
        outletId: dto.outletId,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        subCategory: dto.subCategory,
        price: dto.price,
        taxRate: dto.taxRate ?? 0,
        isVegetarian: dto.isVegetarian,
        allergens: dto.allergens,
        prepTimeMin: dto.prepTimeMin,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateMenuItem(propertyId: string, id: string, dto: Partial<CreateMenuItemDto>) {
    const item = await this.prisma.menuItem.findFirst({ where: { id, propertyId } });
    if (!item) throw new NotFoundException('Menu item not found');

    return this.prisma.menuItem.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category && { category: dto.category }),
        ...(dto.subCategory !== undefined && { subCategory: dto.subCategory }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.taxRate !== undefined && { taxRate: dto.taxRate }),
        ...(dto.isVegetarian !== undefined && { isVegetarian: dto.isVegetarian }),
        ...(dto.allergens && { allergens: dto.allergens }),
        ...(dto.prepTimeMin !== undefined && { prepTimeMin: dto.prepTimeMin }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async toggleMenuItemAvailability(propertyId: string, id: string) {
    const item = await this.prisma.menuItem.findFirst({ where: { id, propertyId } });
    if (!item) throw new NotFoundException('Menu item not found');

    return this.prisma.menuItem.update({
      where: { id },
      data: { isAvailable: !item.isAvailable },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  ORDERS
  // ─────────────────────────────────────────────────────────

  async createOrder(propertyId: string, dto: CreateOrderDto) {
    // Validate outlet
    const outlet = await this.prisma.outlet.findFirst({
      where: { id: dto.outletId, propertyId },
    });
    if (!outlet) throw new NotFoundException('Outlet not found');

    // Fetch all menu items in one query
    const menuItemIds = dto.items.map((i) => i.menuItemId);
    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, propertyId },
    });

    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    // Verify all menu items exist and are available
    for (const orderItem of dto.items) {
      const mi = menuItemMap.get(orderItem.menuItemId);
      if (!mi) {
        throw new NotFoundException(`Menu item ${orderItem.menuItemId} not found`);
      }
      if (!mi.isAvailable) {
        throw new BadRequestException(`Menu item '${mi.name}' is currently unavailable`);
      }
    }

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;

    const itemsData = dto.items.map((orderItem) => {
      const mi = menuItemMap.get(orderItem.menuItemId)!;
      const unitPrice = Number(mi.price);
      const totalPrice = +(unitPrice * orderItem.quantity).toFixed(2);
      const itemTax = +(totalPrice * (Number(mi.taxRate) / 100)).toFixed(2);

      subtotal += totalPrice;
      taxAmount += itemTax;

      return {
        menuItemId: orderItem.menuItemId,
        quantity: orderItem.quantity,
        unitPrice,
        totalPrice,
        modifiers: orderItem.modifiers ?? [],
        notes: orderItem.notes,
      };
    });

    subtotal = +subtotal.toFixed(2);
    taxAmount = +taxAmount.toFixed(2);
    const serviceCharge = +(subtotal * SERVICE_CHARGE_RATE).toFixed(2);
    const total = +(subtotal + taxAmount + serviceCharge).toFixed(2);

    const orderNumber = `ORD-${Date.now()}`;
    const billNumber = `BILL-${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          propertyId,
          outletId: dto.outletId,
          orderNumber,
          guestProfileId: dto.guestProfileId,
          roomNumber: dto.roomNumber,
          tableNumber: dto.tableNumber,
          status: OrderStatus.PENDING,
          type: dto.type ?? 'dine_in',
          subtotal,
          taxAmount,
          serviceCharge,
          total,
          notes: dto.notes,
          items: {
            create: itemsData,
          },
        },
        include: { items: true },
      });

      const bill = await tx.bill.create({
        data: {
          propertyId,
          orderId: order.id,
          billNumber,
          status: BillStatus.OPEN,
          subtotal,
          taxAmount,
          serviceCharge,
          total,
          amountPaid: 0,
          balance: total,
        },
      });

      return { order, bill };
    });
  }

  async getOrder(propertyId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, propertyId },
      include: {
        items: { include: { menuItem: true } },
        bill: true,
        outlet: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async listOrders(
    propertyId: string,
    params: { outletId?: string; status?: OrderStatus; skip: number; take: number },
  ) {
    const { outletId, status, skip, take } = params;

    const where: any = { propertyId };
    if (outletId) where.outletId = outletId;
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          outlet: { select: { id: true, name: true } },
          bill: { select: { status: true, total: true, amountPaid: true, balance: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders, total, skip, take };
  }

  async updateOrderStatus(
    propertyId: string,
    orderId: string,
    dto: UpdateOrderStatusDto,
    userId: string,
  ) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, propertyId } });
    if (!order) throw new NotFoundException('Order not found');

    if (order.isVoid) {
      throw new BadRequestException('Cannot update status of a voided order');
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: dto.status, servedById: userId },
    });
  }

  async voidOrder(propertyId: string, orderId: string, reason: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, propertyId },
      include: { bill: true },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (order.isVoid) throw new BadRequestException('Order is already voided');

    if (order.bill?.status === BillStatus.PAID) {
      throw new BadRequestException('Cannot void an order that has already been paid');
    }

    return this.prisma.$transaction(async (tx) => {
      const voidedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          isVoid: true,
          voidReason: reason,
          voidedAt: new Date(),
          status: OrderStatus.VOID,
        },
      });

      if (order.bill) {
        await tx.bill.update({
          where: { id: order.bill.id },
          data: { status: BillStatus.VOID },
        });
      }

      return voidedOrder;
    });
  }

  async settleBill(propertyId: string, orderId: string, dto: SettleBillDto, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, propertyId },
      include: { bill: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!order.bill) throw new NotFoundException('No bill found for this order');

    const bill = order.bill;

    if (bill.status === BillStatus.PAID) {
      throw new BadRequestException('Bill is already paid');
    }
    if (bill.status === BillStatus.VOID) {
      throw new BadRequestException('Cannot settle a voided bill');
    }

    // Room charge path — post to folio
    if (dto.paymentMethod === PaymentMethod.ROOM_CHARGE) {
      if (!dto.folioChargeId) {
        throw new BadRequestException(
          'folioChargeId is required when paymentMethod is ROOM_CHARGE',
        );
      }

      const folio = await this.prisma.folio.findFirst({
        where: { id: dto.folioChargeId, propertyId },
      });
      if (!folio) throw new NotFoundException('Folio not found for room charge');

      // Post POS charge to folio
      await this.prisma.folioItem.create({
        data: {
          folioId: dto.folioChargeId,
          description: `POS charge — Order ${order.orderNumber}`,
          quantity: 1,
          unitPrice: Number(bill.total),
          amount: Number(bill.total),
          taxAmount: Number(bill.taxAmount),
          referenceType: 'POS_CHARGE',
          referenceId: orderId,
          postedById: userId,
        },
      });

      // Update folio balance
      await this.prisma.folio.update({
        where: { id: dto.folioChargeId },
        data: {
          totalCharges: { increment: Number(bill.total) },
          balance: { increment: Number(bill.total) },
        },
      });
    }

    return this.prisma.bill.update({
      where: { id: bill.id },
      data: {
        status: BillStatus.PAID,
        paymentMethod: dto.paymentMethod,
        splitDetails: dto.splitDetails ?? undefined,
        folioChargeId: dto.folioChargeId,
        amountPaid: Number(bill.total),
        balance: 0,
        closedAt: new Date(),
      },
    });
  }

  async splitBill(
    propertyId: string,
    orderId: string,
    splits: { amount: number; paymentMethod: string }[],
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, propertyId },
      include: { bill: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!order.bill) throw new NotFoundException('No bill found for this order');

    const bill = order.bill;

    if (bill.status === BillStatus.PAID) {
      throw new BadRequestException('Bill is already fully paid');
    }
    if (bill.status === BillStatus.VOID) {
      throw new BadRequestException('Cannot split a voided bill');
    }

    const totalSplit = splits.reduce((sum, s) => sum + s.amount, 0);
    const billTotal = Number(bill.total);
    const amountPaid = +Math.min(totalSplit, billTotal).toFixed(2);
    const balance = +(billTotal - amountPaid).toFixed(2);
    const newStatus = balance === 0 ? BillStatus.PAID : BillStatus.PARTIALLY_PAID;

    return this.prisma.bill.update({
      where: { id: bill.id },
      data: {
        splitDetails: splits,
        amountPaid,
        balance,
        status: newStatus,
        ...(newStatus === BillStatus.PAID && { closedAt: new Date() }),
      },
    });
  }

  async compOrder(propertyId: string, orderId: string, reason: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, propertyId },
      include: { bill: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.isVoid) throw new BadRequestException('Cannot comp a voided order');

    if (order.bill?.status === BillStatus.PAID) {
      throw new BadRequestException('Bill is already settled');
    }

    return this.prisma.$transaction(async (tx) => {
      const compedOrder = await tx.order.update({
        where: { id: orderId },
        data: { isComp: true, compReason: reason },
      });

      if (order.bill) {
        await tx.bill.update({
          where: { id: order.bill.id },
          data: {
            status: BillStatus.PAID,
            paymentMethod: PaymentMethod.COMPLIMENTARY,
            amountPaid: 0,
            balance: 0,
            closedAt: new Date(),
          },
        });
      }

      return compedOrder;
    });
  }

  async getDailySummary(propertyId: string, date: string) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const orders = await this.prisma.order.findMany({
      where: {
        propertyId,
        createdAt: { gte: start, lte: end },
        isVoid: false,
      },
      include: {
        outlet: { select: { id: true, name: true, type: true } },
        items: { include: { menuItem: { select: { id: true, name: true, category: true } } } },
        bill: { select: { status: true, total: true, amountPaid: true } },
      },
    });

    const totalOrders = orders.length;
    const totalRevenue = orders
      .filter((o) => o.bill?.status === BillStatus.PAID)
      .reduce((sum, o) => sum + Number(o.bill!.amountPaid), 0);

    // Breakdown by outlet
    const outletMap = new Map<string, { name: string; orderCount: number; revenue: number }>();
    for (const order of orders) {
      const key = order.outletId;
      if (!outletMap.has(key)) {
        outletMap.set(key, { name: order.outlet.name, orderCount: 0, revenue: 0 });
      }
      const entry = outletMap.get(key)!;
      entry.orderCount += 1;
      if (order.bill?.status === BillStatus.PAID) {
        entry.revenue += Number(order.bill.amountPaid);
      }
    }
    const byOutlet = Array.from(outletMap.entries()).map(([id, data]) => ({ id, ...data }));

    // Top 5 items by quantity sold
    const itemCountMap = new Map<string, { name: string; category: string; quantitySold: number; revenue: number }>();
    for (const order of orders) {
      for (const item of order.items) {
        const key = item.menuItemId;
        if (!itemCountMap.has(key)) {
          itemCountMap.set(key, {
            name: item.menuItem.name,
            category: item.menuItem.category,
            quantitySold: 0,
            revenue: 0,
          });
        }
        const entry = itemCountMap.get(key)!;
        entry.quantitySold += item.quantity;
        entry.revenue += Number(item.totalPrice);
      }
    }

    const topItems = Array.from(itemCountMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 5);

    return {
      date,
      totalOrders,
      totalRevenue: +totalRevenue.toFixed(2),
      byOutlet,
      topItems,
    };
  }
}
