import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { PurchaseOrderStatus } from '@prisma/client';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceiveGoodsDto } from './dto/receive-goods.dto';

@Injectable()
export class ProcurementService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────
  //  SUPPLIERS
  // ─────────────────────────────────────────────────────────

  async createSupplier(propertyId: string, dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        propertyId,
        name: dto.name,
        contactName: dto.contactName,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        taxId: dto.taxId,
        paymentTerms: dto.paymentTerms,
      },
    });
  }

  async listSuppliers(propertyId: string, skip = 0, take = 20) {
    const [suppliers, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where: { propertyId, isActive: true },
        orderBy: { name: 'asc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.supplier.count({ where: { propertyId, isActive: true } }),
    ]);
    return { suppliers, total, skip, take };
  }

  async getSupplier(propertyId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, propertyId },
      include: {
        purchaseOrders: { orderBy: { createdAt: 'desc' }, take: 5 },
        inventoryItems: { where: { isActive: true } },
      },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async updateSupplier(propertyId: string, id: string, dto: Partial<CreateSupplierDto>) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, propertyId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    return this.prisma.supplier.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.contactName !== undefined && { contactName: dto.contactName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.taxId !== undefined && { taxId: dto.taxId }),
        ...(dto.paymentTerms !== undefined && { paymentTerms: dto.paymentTerms }),
      },
    });
  }

  async deactivateSupplier(propertyId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, propertyId } });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return this.prisma.supplier.update({ where: { id }, data: { isActive: false } });
  }

  // ─────────────────────────────────────────────────────────
  //  INVENTORY ITEMS
  // ─────────────────────────────────────────────────────────

  async createInventoryItem(propertyId: string, dto: CreateInventoryItemDto) {
    const existing = await this.prisma.inventoryItem.findFirst({
      where: { propertyId, sku: dto.sku },
    });
    if (existing) throw new ConflictException(`SKU '${dto.sku}' already exists for this property`);

    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplierId, propertyId },
      });
      if (!supplier) throw new NotFoundException('Supplier not found');
    }

    return this.prisma.inventoryItem.create({
      data: {
        propertyId,
        supplierId: dto.supplierId,
        sku: dto.sku,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        unit: dto.unit ?? 'each',
        currentStock: 0,
        reorderPoint: dto.reorderPoint,
        reorderQty: dto.reorderQty,
        unitCost: dto.unitCost,
      },
    });
  }

  async listInventoryItems(
    propertyId: string,
    params: { category?: string; belowReorder?: boolean; skip?: number; take?: number },
  ) {
    const { category, belowReorder, skip = 0, take = 20 } = params;

    const where: any = { propertyId, isActive: true };
    if (category) where.category = category;

    // Filter items below reorder point using Prisma raw comparison
    // We do this in-memory for simplicity (reorderPoint and currentStock are both Decimal)
    let items = await this.prisma.inventoryItem.findMany({
      where,
      include: { supplier: { select: { id: true, name: true } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    if (belowReorder) {
      items = items.filter(
        (i) => Number(i.currentStock) <= Number(i.reorderPoint),
      );
    }

    const total = items.length;
    const paginated = items.slice(Number(skip), Number(skip) + Number(take));

    return { items: paginated, total, skip, take };
  }

  async getInventoryItem(propertyId: string, id: string) {
    const item = await this.prisma.inventoryItem.findFirst({
      where: { id, propertyId },
      include: {
        supplier: true,
        purchaseOrderItems: {
          include: { purchaseOrder: { select: { orderNumber: true, status: true, orderDate: true } } },
          orderBy: { purchaseOrder: { orderDate: 'desc' } },
          take: 5,
        },
      },
    });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  async updateInventoryItem(
    propertyId: string,
    id: string,
    dto: Partial<CreateInventoryItemDto>,
  ) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id, propertyId } });
    if (!item) throw new NotFoundException('Inventory item not found');

    if (dto.sku && dto.sku !== item.sku) {
      const collision = await this.prisma.inventoryItem.findFirst({
        where: { propertyId, sku: dto.sku, id: { not: id } },
      });
      if (collision) throw new ConflictException(`SKU '${dto.sku}' already exists`);
    }

    return this.prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(dto.supplierId !== undefined && { supplierId: dto.supplierId }),
        ...(dto.sku && { sku: dto.sku }),
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category && { category: dto.category }),
        ...(dto.unit && { unit: dto.unit }),
        ...(dto.reorderPoint !== undefined && { reorderPoint: dto.reorderPoint }),
        ...(dto.reorderQty !== undefined && { reorderQty: dto.reorderQty }),
        ...(dto.unitCost !== undefined && { unitCost: dto.unitCost }),
      },
    });
  }

  async getReorderAlerts(propertyId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { propertyId, isActive: true },
      include: { supplier: { select: { id: true, name: true, email: true, phone: true } } },
    });

    const alerts = items.filter(
      (i) => Number(i.currentStock) <= Number(i.reorderPoint),
    );

    return {
      count: alerts.length,
      items: alerts.map((i) => ({
        id: i.id,
        sku: i.sku,
        name: i.name,
        category: i.category,
        currentStock: i.currentStock,
        reorderPoint: i.reorderPoint,
        reorderQty: i.reorderQty,
        unitCost: i.unitCost,
        supplier: i.supplier,
        shortfall: Math.max(0, Number(i.reorderPoint) - Number(i.currentStock)),
      })),
    };
  }

  // ─────────────────────────────────────────────────────────
  //  PURCHASE ORDERS
  // ─────────────────────────────────────────────────────────

  async createPurchaseOrder(
    propertyId: string,
    createdById: string,
    dto: CreatePurchaseOrderDto,
  ) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, propertyId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    // Verify all inventory items belong to this property
    for (const line of dto.items) {
      const item = await this.prisma.inventoryItem.findFirst({
        where: { id: line.inventoryItemId, propertyId },
      });
      if (!item) {
        throw new NotFoundException(`Inventory item '${line.inventoryItemId}' not found`);
      }
    }

    const totalAmount = dto.items.reduce(
      (sum, line) => sum + line.quantity * line.unitPrice,
      0,
    );

    const orderNumber = `PO-${Date.now()}`;

    return this.prisma.purchaseOrder.create({
      data: {
        propertyId,
        supplierId: dto.supplierId,
        orderNumber,
        status: PurchaseOrderStatus.DRAFT,
        orderDate: new Date(dto.orderDate),
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
        totalAmount: +totalAmount.toFixed(2),
        notes: dto.notes,
        createdById,
        items: {
          create: dto.items.map((line) => ({
            inventoryItemId: line.inventoryItemId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            totalPrice: +(line.quantity * line.unitPrice).toFixed(2),
            notes: line.notes,
          })),
        },
      },
      include: { items: { include: { inventoryItem: true } }, supplier: true },
    });
  }

  async getPurchaseOrder(propertyId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, propertyId },
      include: {
        items: { include: { inventoryItem: true } },
        supplier: true,
        goodsReceipts: { include: { items: { include: { inventoryItem: true } } } },
      },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  async listPurchaseOrders(
    propertyId: string,
    params: { status?: PurchaseOrderStatus; supplierId?: string; skip?: number; take?: number },
  ) {
    const { status, supplierId, skip = 0, take = 20 } = params;

    const where: any = { propertyId };
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;

    const [orders, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: { supplier: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { orders, total, skip, take };
  }

  async submitPurchaseOrder(propertyId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, propertyId } });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException(`Cannot submit a purchase order with status '${po.status}'`);
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.SUBMITTED },
    });
  }

  async approvePurchaseOrder(propertyId: string, id: string, approvedById: string) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, propertyId } });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status !== PurchaseOrderStatus.SUBMITTED) {
      throw new BadRequestException(`Purchase order must be SUBMITTED to approve (current: ${po.status})`);
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.APPROVED,
        approvedById,
        approvedAt: new Date(),
      },
    });
  }

  async cancelPurchaseOrder(propertyId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({ where: { id, propertyId } });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (
      po.status === PurchaseOrderStatus.RECEIVED ||
      po.status === PurchaseOrderStatus.CANCELLED
    ) {
      throw new BadRequestException(`Cannot cancel a ${po.status} purchase order`);
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.CANCELLED },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  GOODS RECEIPT
  // ─────────────────────────────────────────────────────────

  async receiveGoods(
    propertyId: string,
    purchaseOrderId: string,
    receivedById: string,
    dto: ReceiveGoodsDto,
  ) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, propertyId },
      include: { items: true },
    });
    if (!po) throw new NotFoundException('Purchase order not found');

    if (po.status !== PurchaseOrderStatus.APPROVED && po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED) {
      throw new BadRequestException(
        `Purchase order must be APPROVED or PARTIALLY_RECEIVED to receive goods (current: ${po.status})`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Create goods receipt
      const receipt = await tx.goodsReceipt.create({
        data: {
          purchaseOrderId,
          receivedById,
          receivedDate: new Date(dto.receivedDate),
          notes: dto.notes,
          items: {
            create: dto.items.map((line) => ({
              inventoryItemId: line.inventoryItemId,
              quantity: line.quantity,
              unitCost: line.unitCost,
              notes: line.notes,
            })),
          },
        },
        include: { items: true },
      });

      // Update inventory stock levels and last purchase date
      for (const line of dto.items) {
        await tx.inventoryItem.update({
          where: { id: line.inventoryItemId },
          data: {
            currentStock: { increment: line.quantity },
            unitCost: line.unitCost,
            lastPurchaseDate: new Date(dto.receivedDate),
          },
        });

        // Update received quantity on the PO line
        await tx.purchaseOrderItem.updateMany({
          where: { purchaseOrderId, inventoryItemId: line.inventoryItemId },
          data: { receivedQty: { increment: line.quantity } },
        });
      }

      // Determine new PO status
      const updatedPoItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId },
      });
      const fullyReceived = updatedPoItems.every(
        (item) => Number(item.receivedQty) >= Number(item.quantity),
      );

      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          status: fullyReceived
            ? PurchaseOrderStatus.RECEIVED
            : PurchaseOrderStatus.PARTIALLY_RECEIVED,
        },
      });

      return receipt;
    });
  }
}
