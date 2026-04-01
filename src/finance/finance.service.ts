import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { InvoiceStatus } from '@prisma/client';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────
  //  CHART OF ACCOUNTS
  // ─────────────────────────────────────────────────────────

  async listChartOfAccounts(propertyId: string) {
    return this.prisma.chartOfAccount.findMany({
      where: { propertyId, isActive: true },
      orderBy: [{ type: 'asc' }, { code: 'asc' }],
      include: {
        parent: { select: { id: true, code: true, name: true } },
        _count: { select: { children: true } },
      },
    });
  }

  async getAccount(propertyId: string, id: string) {
    const account = await this.prisma.chartOfAccount.findFirst({
      where: { id, propertyId },
      include: {
        parent: true,
        children: { where: { isActive: true } },
        journalLines: {
          orderBy: { journalEntry: { entryDate: 'desc' } },
          take: 10,
          include: { journalEntry: true },
        },
      },
    });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  // ─────────────────────────────────────────────────────────
  //  JOURNAL ENTRIES — immutable, no update/delete
  // ─────────────────────────────────────────────────────────

  async createJournalEntry(propertyId: string, dto: CreateJournalEntryDto, userId: string) {
    // Validate double-entry: total debits must equal total credits
    const totalDebits = dto.lines
      .filter((l) => l.type === 'DEBIT')
      .reduce((sum, l) => sum + l.amount, 0);
    const totalCredits = dto.lines
      .filter((l) => l.type === 'CREDIT')
      .reduce((sum, l) => sum + l.amount, 0);

    if (Math.abs(totalDebits - totalCredits) > 0.001) {
      throw new BadRequestException(
        `Journal entry does not balance: debits ${totalDebits.toFixed(2)} ≠ credits ${totalCredits.toFixed(2)}`,
      );
    }

    if (dto.lines.length < 2) {
      throw new BadRequestException('A journal entry requires at least two lines');
    }

    // Verify all accounts belong to this property
    const accountIds = [...new Set(dto.lines.map((l) => l.accountId))];
    const accounts = await this.prisma.chartOfAccount.findMany({
      where: { id: { in: accountIds }, propertyId },
    });
    if (accounts.length !== accountIds.length) {
      throw new BadRequestException('One or more accounts not found for this property');
    }

    const entryNumber = `JE-${Date.now()}`;

    return this.prisma.journalEntry.create({
      data: {
        propertyId,
        entryNumber,
        description: dto.description,
        referenceType: dto.referenceType,
        referenceId: dto.referenceId,
        entryDate: new Date(dto.entryDate),
        postedById: userId,
        lines: {
          create: dto.lines.map((l) => ({
            accountId: l.accountId,
            type: l.type,
            amount: l.amount,
            description: l.description,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    });
  }

  async getJournalEntry(propertyId: string, id: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, propertyId },
      include: { lines: { include: { account: true } } },
    });
    if (!entry) throw new NotFoundException('Journal entry not found');
    return entry;
  }

  async listJournalEntries(
    propertyId: string,
    params: {
      fromDate?: string;
      toDate?: string;
      referenceType?: string;
      skip?: number;
      take?: number;
    },
  ) {
    const { fromDate, toDate, referenceType, skip = 0, take = 20 } = params;

    const where: any = { propertyId };
    if (referenceType) where.referenceType = referenceType;
    if (fromDate || toDate) {
      where.entryDate = {};
      if (fromDate) where.entryDate.gte = new Date(fromDate);
      if (toDate) where.entryDate.lte = new Date(toDate);
    }

    const [entries, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        orderBy: { entryDate: 'desc' },
        skip: Number(skip),
        take: Number(take),
        include: { lines: { include: { account: { select: { code: true, name: true } } } } },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return { entries, total, skip, take };
  }

  // Journal entries are IMMUTABLE — no update or delete endpoints are exposed.
  // Corrections are made by posting a reversal entry.
  async reverseJournalEntry(propertyId: string, id: string, userId: string) {
    const original = await this.prisma.journalEntry.findFirst({
      where: { id, propertyId },
      include: { lines: true },
    });
    if (!original) throw new NotFoundException('Journal entry not found');
    if (original.isReversed) {
      throw new BadRequestException('This journal entry has already been reversed');
    }

    const reversalNumber = `JE-REV-${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      const reversal = await tx.journalEntry.create({
        data: {
          propertyId,
          entryNumber: reversalNumber,
          description: `Reversal of ${original.entryNumber}: ${original.description}`,
          referenceType: 'reversal',
          referenceId: original.id,
          entryDate: new Date(),
          postedById: userId,
          lines: {
            create: original.lines.map((l) => ({
              accountId: l.accountId,
              // Flip debit ↔ credit
              type: l.type === 'DEBIT' ? 'CREDIT' : 'DEBIT',
              amount: l.amount,
              description: `Reversal: ${l.description ?? ''}`,
            })),
          },
        },
        include: { lines: { include: { account: true } } },
      });

      await tx.journalEntry.update({
        where: { id },
        data: { isReversed: true, reversalId: reversal.id },
      });

      return reversal;
    });
  }

  // ─────────────────────────────────────────────────────────
  //  INVOICES
  // ─────────────────────────────────────────────────────────

  async createInvoice(propertyId: string, dto: CreateInvoiceDto, userId: string) {
    if (!dto.guestProfileId && !dto.companyName) {
      throw new BadRequestException('Invoice must have either a guest profile or a company name');
    }

    const total = +(dto.subtotal + dto.taxAmount).toFixed(2);
    const invoiceNumber = `INV-${Date.now()}`;

    return this.prisma.invoice.create({
      data: {
        propertyId,
        invoiceNumber,
        guestProfileId: dto.guestProfileId,
        companyName: dto.companyName,
        dueDate: new Date(dto.dueDate),
        status: InvoiceStatus.DRAFT,
        subtotal: dto.subtotal,
        taxAmount: dto.taxAmount,
        total,
        amountPaid: 0,
        balance: total,
        notes: dto.notes,
        createdById: userId,
      },
    });
  }

  async getInvoice(propertyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, propertyId },
      include: { receipts: { orderBy: { createdAt: 'desc' } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async listInvoices(
    propertyId: string,
    params: { status?: InvoiceStatus; skip?: number; take?: number },
  ) {
    const { status, skip = 0, take = 20 } = params;

    const where: any = { propertyId };
    if (status) where.status = status;

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
        include: { _count: { select: { receipts: true } } },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { invoices, total, skip, take };
  }

  async sendInvoice(propertyId: string, id: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, propertyId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(`Cannot send an invoice with status '${invoice.status}'`);
    }

    return this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.SENT, sentAt: new Date() },
    });
  }

  async finalizeInvoice(propertyId: string, id: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, propertyId },
      include: { receipts: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already marked as paid');
    }
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot finalize a cancelled invoice');
    }

    const totalPaid = invoice.receipts.reduce((sum, r) => sum + Number(r.amount), 0);
    const balance = +(Number(invoice.total) - totalPaid).toFixed(2);

    if (balance > 0) {
      throw new BadRequestException(
        `Invoice has an outstanding balance of ${balance}. Post receipts before finalising.`,
      );
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.PAID,
        amountPaid: totalPaid,
        balance: 0,
        paidAt: new Date(),
      },
    });
  }

  async cancelInvoice(propertyId: string, id: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, propertyId } });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot cancel a paid invoice');
    }
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Invoice is already cancelled');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.CANCELLED },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  RECEIPTS
  // ─────────────────────────────────────────────────────────

  async createReceipt(propertyId: string, dto: CreateReceiptDto, userId: string) {
    // If linked to an invoice, verify it belongs to this property
    if (dto.invoiceId) {
      const invoice = await this.prisma.invoice.findFirst({
        where: { id: dto.invoiceId, propertyId },
        include: { receipts: true },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');

      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new BadRequestException('Cannot post receipt against a cancelled invoice');
      }

      // Don't over-pay an invoice
      const alreadyPaid = invoice.receipts.reduce((s, r) => s + Number(r.amount), 0);
      const remaining = +(Number(invoice.total) - alreadyPaid).toFixed(2);
      if (dto.amount > remaining + 0.01) {
        throw new BadRequestException(
          `Receipt amount ${dto.amount} exceeds remaining invoice balance ${remaining}`,
        );
      }
    }

    const receiptNumber = `RCP-${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.create({
        data: {
          propertyId,
          invoiceId: dto.invoiceId,
          receiptNumber,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          reference: dto.reference,
          notes: dto.notes,
          createdById: userId,
        },
      });

      // Update invoice balance if linked
      if (dto.invoiceId) {
        const invoice = await tx.invoice.findUnique({
          where: { id: dto.invoiceId },
          include: { receipts: true },
        });
        if (invoice) {
          const totalPaid = invoice.receipts.reduce((s, r) => s + Number(r.amount), 0);
          const balance = +(Number(invoice.total) - totalPaid).toFixed(2);
          const isPaid = balance <= 0;

          await tx.invoice.update({
            where: { id: dto.invoiceId },
            data: {
              amountPaid: +totalPaid.toFixed(2),
              balance: isPaid ? 0 : balance,
              status: isPaid ? InvoiceStatus.PAID : invoice.status,
              paidAt: isPaid ? new Date() : invoice.paidAt,
            },
          });
        }
      }

      return receipt;
    });
  }

  async getReceipt(propertyId: string, id: string) {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id, propertyId },
      include: { invoice: true },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    return receipt;
  }

  async listReceipts(propertyId: string, params: { skip?: number; take?: number }) {
    const { skip = 0, take = 20 } = params;

    const [receipts, total] = await Promise.all([
      this.prisma.receipt.findMany({
        where: { propertyId },
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
        include: { invoice: { select: { invoiceNumber: true, status: true } } },
      }),
      this.prisma.receipt.count({ where: { propertyId } }),
    ]);

    return { receipts, total, skip, take };
  }

  // ─────────────────────────────────────────────────────────
  //  DAILY BALANCE SNAPSHOT
  // ─────────────────────────────────────────────────────────

  async getDailyBalanceSnapshot(propertyId: string, date: string) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Check for pre-computed revenue snapshot
    const snapshot = await this.prisma.revenueSnapshot.findUnique({
      where: { propertyId_snapshotDate: { propertyId, snapshotDate: targetDate } },
    });

    // Receipts received on this day
    const receiptsToday = await this.prisma.receipt.findMany({
      where: {
        propertyId,
        createdAt: { gte: targetDate, lt: nextDay },
      },
    });

    const totalReceiptsAmount = receiptsToday.reduce((s, r) => s + Number(r.amount), 0);
    const receiptsByMethod = receiptsToday.reduce<Record<string, number>>((acc, r) => {
      acc[r.paymentMethod] = (acc[r.paymentMethod] ?? 0) + Number(r.amount);
      return acc;
    }, {});

    // Journal entries for this day
    const journalEntriesToday = await this.prisma.journalEntry.count({
      where: {
        propertyId,
        entryDate: { gte: targetDate, lt: nextDay },
        isReversed: false,
      },
    });

    // Outstanding invoices as of this date
    const [overdueCount, overdueTotal] = await Promise.all([
      this.prisma.invoice.count({
        where: {
          propertyId,
          status: { in: [InvoiceStatus.SENT] },
          dueDate: { lt: targetDate },
        },
      }),
      this.prisma.invoice.aggregate({
        where: {
          propertyId,
          status: { in: [InvoiceStatus.SENT] },
          dueDate: { lt: targetDate },
        },
        _sum: { balance: true },
      }),
    ]);

    return {
      date: targetDate.toISOString().split('T')[0],
      revenueSnapshot: snapshot,
      receipts: {
        count: receiptsToday.length,
        totalAmount: +totalReceiptsAmount.toFixed(2),
        byMethod: receiptsByMethod,
      },
      journalEntries: { count: journalEntriesToday },
      overdue: {
        invoiceCount: overdueCount,
        totalBalance: +(Number(overdueTotal._sum.balance ?? 0)).toFixed(2),
      },
    };
  }

  // ─────────────────────────────────────────────────────────
  //  AUDIT LOG — read-only, no create/update/delete
  // ─────────────────────────────────────────────────────────

  async getAuditLog(propertyId: string, id: string) {
    const log = await this.prisma.auditLog.findFirst({ where: { id, propertyId } });
    if (!log) throw new NotFoundException('Audit log entry not found');
    return log;
  }

  async listAuditLog(
    propertyId: string,
    params: {
      entityType?: string;
      entityId?: string;
      actorId?: string;
      fromDate?: string;
      toDate?: string;
      skip?: number;
      take?: number;
    },
  ) {
    const { entityType, entityId, actorId, fromDate, toDate, skip = 0, take = 50 } = params;

    const where: any = { propertyId };
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (actorId) where.actorId = actorId;
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: Number(skip),
        take: Number(take),
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total, skip, take };
  }
}
