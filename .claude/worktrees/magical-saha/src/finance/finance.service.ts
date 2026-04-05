import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { AccountType, JournalEntryType, InvoiceStatus } from '@prisma/client';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────
  //  Chart of Accounts
  // ─────────────────────────────────────────────────────────────────

  async createAccount(propertyId: string, dto: CreateAccountDto, userId: string) {
    // Unique code per property
    const existing = await this.prisma.chartOfAccount.findUnique({
      where: { propertyId_code: { propertyId, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(`Account with code '${dto.code}' already exists`);
    }

    if (dto.parentId) {
      const parent = await this.prisma.chartOfAccount.findFirst({
        where: { id: dto.parentId, propertyId },
      });
      if (!parent) throw new NotFoundException(`Parent account ${dto.parentId} not found`);
    }

    const account = await this.prisma.chartOfAccount.create({
      data: {
        propertyId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        parentId: dto.parentId,
        description: dto.description,
      },
      include: { parent: true },
    });

    await this.writeAuditLog(propertyId, userId, 'CREATE', 'ChartOfAccount', account.id, null, account);
    return account;
  }

  async listAccounts(propertyId: string, type?: AccountType) {
    const accounts = await this.prisma.chartOfAccount.findMany({
      where: { propertyId, isActive: true, ...(type ? { type } : {}) },
      include: { children: { where: { isActive: true } } },
      orderBy: { code: 'asc' },
    });

    // Return only root accounts (parentId = null); children are nested via include
    return accounts.filter((a) => !a.parentId);
  }

  async getAccount(propertyId: string, id: string) {
    const account = await this.prisma.chartOfAccount.findFirst({
      where: { id, propertyId },
      include: { parent: true, children: { where: { isActive: true } } },
    });
    if (!account) throw new NotFoundException(`Account ${id} not found`);
    return account;
  }

  async updateAccount(propertyId: string, id: string, dto: Partial<CreateAccountDto>, userId: string) {
    const account = await this.prisma.chartOfAccount.findFirst({ where: { id, propertyId } });
    if (!account) throw new NotFoundException(`Account ${id} not found`);

    const oldValues = { ...account };

    const updated = await this.prisma.chartOfAccount.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
      },
    });

    await this.writeAuditLog(propertyId, userId, 'UPDATE', 'ChartOfAccount', id, oldValues, updated);
    return updated;
  }

  async deactivateAccount(propertyId: string, id: string, userId: string) {
    const account = await this.prisma.chartOfAccount.findFirst({ where: { id, propertyId } });
    if (!account) throw new NotFoundException(`Account ${id} not found`);

    // Check for children
    const childCount = await this.prisma.chartOfAccount.count({
      where: { parentId: id, isActive: true },
    });
    if (childCount > 0) {
      throw new BadRequestException('Cannot deactivate an account that has active child accounts');
    }

    const updated = await this.prisma.chartOfAccount.update({
      where: { id },
      data: { isActive: false },
    });

    await this.writeAuditLog(propertyId, userId, 'DEACTIVATE', 'ChartOfAccount', id, account, updated);
    return updated;
  }

  // ─────────────────────────────────────────────────────────────────
  //  Journal Entries
  // ─────────────────────────────────────────────────────────────────

  async createJournalEntry(propertyId: string, dto: CreateJournalEntryDto, userId: string) {
    // Validate balanced debits and credits
    let totalDebits = 0;
    let totalCredits = 0;
    for (const line of dto.lines) {
      if (line.type === JournalEntryType.DEBIT) totalDebits += Number(line.amount);
      else totalCredits += Number(line.amount);
    }

    const diff = Math.abs(totalDebits - totalCredits);
    if (diff > 0.001) {
      throw new BadRequestException(
        `Journal entry is not balanced. Debits: ${totalDebits.toFixed(2)}, Credits: ${totalCredits.toFixed(2)}`,
      );
    }

    // Verify all accounts exist and belong to this property
    for (const line of dto.lines) {
      const account = await this.prisma.chartOfAccount.findFirst({
        where: { id: line.accountId, propertyId, isActive: true },
      });
      if (!account) {
        throw new NotFoundException(`Account ${line.accountId} not found or inactive`);
      }
    }

    const entryNumber = `JE-${Date.now()}`;

    const entry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.journalEntry.create({
        data: {
          propertyId,
          entryNumber,
          description: dto.description,
          referenceType: dto.referenceType,
          referenceId: dto.referenceId,
          entryDate: new Date(dto.entryDate),
          postedById: userId,
          lines: {
            create: dto.lines.map((line) => ({
              accountId: line.accountId,
              type: line.type,
              amount: line.amount,
              description: line.description,
            })),
          },
        },
        include: { lines: { include: { account: true } } },
      });

      // Write immutable audit log
      await tx.auditLog.create({
        data: {
          propertyId,
          actorId: userId,
          actorRole: 'FINANCE',
          action: 'CREATE',
          entityType: 'JournalEntry',
          entityId: created.id,
          newValues: created as unknown as Record<string, unknown>,
        },
      });

      return created;
    });

    return entry;
  }

  async listJournalEntries(
    propertyId: string,
    fromDate?: string,
    toDate?: string,
    skip = 0,
    take = 20,
  ) {
    const where: Parameters<typeof this.prisma.journalEntry.findMany>[0]['where'] = {
      propertyId,
      ...(fromDate || toDate
        ? {
            entryDate: {
              ...(fromDate ? { gte: new Date(fromDate) } : {}),
              ...(toDate ? { lte: new Date(toDate) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        include: { lines: { include: { account: { select: { code: true, name: true, type: true } } } } },
        orderBy: { entryDate: 'desc' },
        skip,
        take,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return { items, total, skip, take };
  }

  async getJournalEntry(propertyId: string, id: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, propertyId },
      include: { lines: { include: { account: true } } },
    });
    if (!entry) throw new NotFoundException(`Journal entry ${id} not found`);
    return entry;
  }

  async reverseJournalEntry(
    propertyId: string,
    id: string,
    reason: string,
    userId: string,
  ) {
    const original = await this.prisma.journalEntry.findFirst({
      where: { id, propertyId },
      include: { lines: true },
    });
    if (!original) throw new NotFoundException(`Journal entry ${id} not found`);
    if (original.isReversed) {
      throw new ConflictException('This journal entry has already been reversed');
    }

    const reversalNumber = `JE-REV-${Date.now()}`;

    return this.prisma.$transaction(async (tx) => {
      // Create reversal entry with opposite signs
      const reversal = await tx.journalEntry.create({
        data: {
          propertyId,
          entryNumber: reversalNumber,
          description: `REVERSAL of ${original.entryNumber}: ${reason}`,
          referenceType: 'journal_entry',
          referenceId: original.id,
          entryDate: new Date(),
          postedById: userId,
          lines: {
            create: original.lines.map((line) => ({
              accountId: line.accountId,
              // Flip debit <-> credit
              type:
                line.type === JournalEntryType.DEBIT
                  ? JournalEntryType.CREDIT
                  : JournalEntryType.DEBIT,
              amount: line.amount,
              description: `Reversal: ${line.description ?? ''}`,
            })),
          },
        },
        include: { lines: { include: { account: true } } },
      });

      // Mark original as reversed
      await tx.journalEntry.update({
        where: { id },
        data: { isReversed: true, reversalId: reversal.id },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          propertyId,
          actorId: userId,
          actorRole: 'FINANCE',
          action: 'REVERSE',
          entityType: 'JournalEntry',
          entityId: id,
          newValues: { reversalId: reversal.id, reason } as Record<string, unknown>,
        },
      });

      return { original: { id, isReversed: true }, reversal };
    });
  }

  // ─────────────────────────────────────────────────────────────────
  //  Invoices
  // ─────────────────────────────────────────────────────────────────

  async createInvoice(propertyId: string, dto: CreateInvoiceDto, userId: string) {
    const invoiceNumber = `INV-${Date.now()}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        propertyId,
        invoiceNumber,
        guestProfileId: dto.guestProfileId,
        companyName: dto.companyName,
        dueDate: new Date(dto.dueDate),
        status: InvoiceStatus.DRAFT,
        subtotal: dto.subtotal,
        taxAmount: dto.taxAmount,
        total: dto.total,
        balance: dto.total,
        amountPaid: 0,
        notes: dto.notes,
        createdById: userId,
      },
    });

    await this.writeAuditLog(propertyId, userId, 'CREATE', 'Invoice', invoice.id, null, invoice);
    return invoice;
  }

  async listInvoices(
    propertyId: string,
    status?: InvoiceStatus,
    skip = 0,
    take = 20,
  ) {
    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { propertyId, ...(status ? { status } : {}) },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.invoice.count({ where: { propertyId, ...(status ? { status } : {}) } }),
    ]);

    return { items, total, skip, take };
  }

  async getInvoice(propertyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, propertyId },
      include: { receipts: true },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
    return invoice;
  }

  async sendInvoice(propertyId: string, id: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, propertyId } });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot send a cancelled invoice');
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { sentAt: new Date(), status: InvoiceStatus.SENT },
    });

    // In production: trigger email send here
    this.logger.log(`Invoice ${invoice.invoiceNumber} marked as SENT for property ${propertyId}`);
    await this.writeAuditLog(propertyId, userId, 'SEND', 'Invoice', id, invoice, updated);
    return updated;
  }

  async cancelInvoice(propertyId: string, id: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, propertyId } });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot cancel a paid invoice');
    }
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new ConflictException('Invoice is already cancelled');
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.CANCELLED },
    });

    await this.writeAuditLog(propertyId, userId, 'CANCEL', 'Invoice', id, invoice, updated);
    return updated;
  }

  // ─────────────────────────────────────────────────────────────────
  //  Receipts
  // ─────────────────────────────────────────────────────────────────

  async createReceipt(propertyId: string, dto: CreateReceiptDto, userId: string) {
    const receiptNumber = `REC-${Date.now()}`;

    const receipt = await this.prisma.$transaction(async (tx) => {
      const created = await tx.receipt.create({
        data: {
          propertyId,
          receiptNumber,
          invoiceId: dto.invoiceId,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          reference: dto.reference,
          notes: dto.notes,
          createdById: userId,
        },
      });

      // If linked to an invoice, update balance
      if (dto.invoiceId) {
        const invoice = await tx.invoice.findFirst({
          where: { id: dto.invoiceId, propertyId },
        });
        if (!invoice) throw new NotFoundException(`Invoice ${dto.invoiceId} not found`);

        const newAmountPaid = Number(invoice.amountPaid) + dto.amount;
        const newBalance = Number(invoice.total) - newAmountPaid;
        const newStatus =
          newBalance <= 0
            ? InvoiceStatus.PAID
            : newAmountPaid > 0
            ? InvoiceStatus.SENT
            : invoice.status;

        await tx.invoice.update({
          where: { id: dto.invoiceId },
          data: {
            amountPaid: newAmountPaid,
            balance: newBalance < 0 ? 0 : newBalance,
            status: newStatus,
            ...(newStatus === InvoiceStatus.PAID ? { paidAt: new Date() } : {}),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          propertyId,
          actorId: userId,
          actorRole: 'FINANCE',
          action: 'CREATE',
          entityType: 'Receipt',
          entityId: created.id,
          newValues: created as unknown as Record<string, unknown>,
        },
      });

      return created;
    });

    return receipt;
  }

  async listReceipts(propertyId: string, invoiceId?: string, skip = 0, take = 20) {
    const [items, total] = await Promise.all([
      this.prisma.receipt.findMany({
        where: { propertyId, ...(invoiceId ? { invoiceId } : {}) },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.receipt.count({
        where: { propertyId, ...(invoiceId ? { invoiceId } : {}) },
      }),
    ]);

    return { items, total, skip, take };
  }

  // ─────────────────────────────────────────────────────────────────
  //  Reporting
  // ─────────────────────────────────────────────────────────────────

  async getDailyBalanceSheet(propertyId: string, date: string) {
    const targetDate = new Date(date);
    const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

    const lines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          propertyId,
          entryDate: { gte: targetDate, lt: nextDay },
          isReversed: false,
        },
      },
      include: {
        account: { select: { type: true, code: true, name: true } },
      },
    });

    const totals: Record<AccountType, { debit: number; credit: number }> = {
      ASSET: { debit: 0, credit: 0 },
      LIABILITY: { debit: 0, credit: 0 },
      EQUITY: { debit: 0, credit: 0 },
      REVENUE: { debit: 0, credit: 0 },
      EXPENSE: { debit: 0, credit: 0 },
    };

    for (const line of lines) {
      const type = line.account.type;
      const amount = Number(line.amount);
      if (line.type === JournalEntryType.DEBIT) totals[type].debit += amount;
      else totals[type].credit += amount;
    }

    const assets = totals.ASSET.debit - totals.ASSET.credit;
    const liabilities = totals.LIABILITY.credit - totals.LIABILITY.debit;
    const equity = totals.EQUITY.credit - totals.EQUITY.debit;
    const revenue = totals.REVENUE.credit - totals.REVENUE.debit;
    const expenses = totals.EXPENSE.debit - totals.EXPENSE.credit;
    const netIncome = revenue - expenses;

    return {
      date,
      assets: Math.round(assets * 100) / 100,
      liabilities: Math.round(liabilities * 100) / 100,
      equity: Math.round(equity * 100) / 100,
      revenue: Math.round(revenue * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      netIncome: Math.round(netIncome * 100) / 100,
    };
  }

  async getTrialBalance(propertyId: string, fromDate: string, toDate: string) {
    const lines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: {
          propertyId,
          entryDate: { gte: new Date(fromDate), lte: new Date(toDate) },
          isReversed: false,
        },
      },
      include: {
        account: { select: { id: true, code: true, name: true, type: true } },
      },
    });

    const accountMap = new Map<
      string,
      { accountId: string; code: string; name: string; type: AccountType; debit: number; credit: number }
    >();

    for (const line of lines) {
      const key = line.accountId;
      const existing = accountMap.get(key) ?? {
        accountId: line.account.id,
        code: line.account.code,
        name: line.account.name,
        type: line.account.type,
        debit: 0,
        credit: 0,
      };

      if (line.type === JournalEntryType.DEBIT) existing.debit += Number(line.amount);
      else existing.credit += Number(line.amount);

      accountMap.set(key, existing);
    }

    const rows = Array.from(accountMap.values())
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((row) => ({
        ...row,
        debit: Math.round(row.debit * 100) / 100,
        credit: Math.round(row.credit * 100) / 100,
        balance: Math.round((row.debit - row.credit) * 100) / 100,
      }));

    const totals = rows.reduce(
      (acc, r) => ({ totalDebit: acc.totalDebit + r.debit, totalCredit: acc.totalCredit + r.credit }),
      { totalDebit: 0, totalCredit: 0 },
    );

    return {
      fromDate,
      toDate,
      rows,
      totals: {
        totalDebit: Math.round(totals.totalDebit * 100) / 100,
        totalCredit: Math.round(totals.totalCredit * 100) / 100,
        isBalanced: Math.abs(totals.totalDebit - totals.totalCredit) < 0.01,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────
  //  Audit Logs (immutable — read only)
  // ─────────────────────────────────────────────────────────────────

  async listAuditLogs(
    propertyId: string,
    entityType?: string,
    actorId?: string,
    fromDate?: string,
    toDate?: string,
    skip = 0,
    take = 20,
  ) {
    const where: Parameters<typeof this.prisma.auditLog.findMany>[0]['where'] = {
      propertyId,
      ...(entityType ? { entityType } : {}),
      ...(actorId ? { actorId } : {}),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: new Date(fromDate) } : {}),
              ...(toDate ? { lte: new Date(toDate) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { actor: { select: { firstName: true, lastName: true, email: true, role: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, skip, take };
  }

  async getAuditLog(propertyId: string, id: string) {
    const log = await this.prisma.auditLog.findFirst({
      where: { id, propertyId },
      include: { actor: { select: { firstName: true, lastName: true, email: true, role: true } } },
    });
    if (!log) throw new NotFoundException(`Audit log ${id} not found`);
    return log;
  }

  // ─────────────────────────────────────────────────────────────────
  //  Private Helpers
  // ─────────────────────────────────────────────────────────────────

  private async writeAuditLog(
    propertyId: string,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    oldValues: unknown,
    newValues: unknown,
  ) {
    try {
      // Fetch actor role for the audit log
      const user = await this.prisma.user.findFirst({
        where: { id: actorId, propertyId },
        select: { role: true },
      });

      await this.prisma.auditLog.create({
        data: {
          propertyId,
          actorId,
          actorRole: user?.role ?? 'UNKNOWN',
          action,
          entityType,
          entityId,
          oldValues: oldValues as Record<string, unknown> | null,
          newValues: newValues as Record<string, unknown> | null,
        },
      });
    } catch (err) {
      // Audit log write failure must not break the main operation
      this.logger.error(`Failed to write audit log for ${entityType} ${entityId}: ${err}`);
    }
  }
}
