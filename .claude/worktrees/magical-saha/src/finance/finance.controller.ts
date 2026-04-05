import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PropertyId } from '../../common/decorators/property-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FinanceService } from './finance.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { AccountType, InvoiceStatus } from '@prisma/client';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // ─── Chart of Accounts ───────────────────────────────────────────

  @Post('accounts')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Create a new account in the chart of accounts' })
  createAccount(
    @PropertyId() propertyId: string,
    @Body() dto: CreateAccountDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.financeService.createAccount(propertyId, dto, userId);
  }

  @Get('accounts')
  @ApiOperation({ summary: 'List chart of accounts (tree structure), optionally filtered by type' })
  @ApiQuery({ name: 'type', required: false, enum: AccountType })
  listAccounts(
    @PropertyId() propertyId: string,
    @Query('type') type?: AccountType,
  ) {
    return this.financeService.listAccounts(propertyId, type);
  }

  @Get('accounts/:id')
  @ApiOperation({ summary: 'Get a single account with its parent and children' })
  getAccount(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.financeService.getAccount(propertyId, id);
  }

  @Patch('accounts/:id')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Update an account' })
  updateAccount(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateAccountDto>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.financeService.updateAccount(propertyId, id, dto, userId);
  }

  @Delete('accounts/:id')
  @Roles('GM', 'ADMIN')
  @ApiOperation({ summary: 'Deactivate (soft-delete) an account' })
  deactivateAccount(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.financeService.deactivateAccount(propertyId, id, userId);
  }

  // ─── Journal Entries ──────────────────────────────────────────────

  @Post('journal-entries')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Create a balanced journal entry (debits must equal credits)' })
  createJournalEntry(
    @PropertyId() propertyId: string,
    @Body() dto: CreateJournalEntryDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.financeService.createJournalEntry(propertyId, dto, userId);
  }

  @Get('journal-entries')
  @ApiOperation({ summary: 'List journal entries with optional date range filter' })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listJournalEntries(
    @PropertyId() propertyId: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.financeService.listJournalEntries(
      propertyId,
      fromDate,
      toDate,
      (page - 1) * limit,
      limit,
    );
  }

  @Get('journal-entries/:id')
  @ApiOperation({ summary: 'Get a single journal entry with all lines' })
  getJournalEntry(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.financeService.getJournalEntry(propertyId, id);
  }

  @Post('journal-entries/:id/reverse')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Create a reversal entry for an existing journal entry' })
  reverseJournalEntry(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @Body() body: { reason: string },
    @CurrentUser('sub') userId: string,
  ) {
    return this.financeService.reverseJournalEntry(propertyId, id, body.reason, userId);
  }

  // ─── Invoices ─────────────────────────────────────────────────────

  @Post('invoices')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Create a new invoice' })
  createInvoice(
    @PropertyId() propertyId: string,
    @Body() dto: CreateInvoiceDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.financeService.createInvoice(propertyId, dto, userId);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List invoices, optionally filtered by status' })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listInvoices(
    @PropertyId() propertyId: string,
    @Query('status') status?: InvoiceStatus,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.financeService.listInvoices(propertyId, status, (page - 1) * limit, limit);
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get a single invoice with receipts' })
  getInvoice(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.financeService.getInvoice(propertyId, id);
  }

  @Post('invoices/:id/send')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Mark an invoice as sent (triggers email in production)' })
  sendInvoice(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.financeService.sendInvoice(propertyId, id, userId);
  }

  @Post('invoices/:id/cancel')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Cancel an invoice (cannot cancel paid invoices)' })
  cancelInvoice(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.financeService.cancelInvoice(propertyId, id, userId);
  }

  // ─── Receipts ─────────────────────────────────────────────────────

  @Post('receipts')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Record a payment receipt and update invoice balance if applicable' })
  createReceipt(
    @PropertyId() propertyId: string,
    @Body() dto: CreateReceiptDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.financeService.createReceipt(propertyId, dto, userId);
  }

  @Get('receipts')
  @ApiOperation({ summary: 'List receipts, optionally filtered by invoice' })
  @ApiQuery({ name: 'invoiceId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listReceipts(
    @PropertyId() propertyId: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.financeService.listReceipts(propertyId, invoiceId, (page - 1) * limit, limit);
  }

  // ─── Reporting ────────────────────────────────────────────────────

  @Get('balance-sheet')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Get a daily balance sheet summary for a specific date' })
  @ApiQuery({ name: 'date', required: true, description: 'Date YYYY-MM-DD' })
  getDailyBalanceSheet(@PropertyId() propertyId: string, @Query('date') date: string) {
    return this.financeService.getDailyBalanceSheet(propertyId, date);
  }

  @Get('trial-balance')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Get a trial balance for a date range — all accounts with debit/credit totals' })
  @ApiQuery({ name: 'fromDate', required: true })
  @ApiQuery({ name: 'toDate', required: true })
  getTrialBalance(
    @PropertyId() propertyId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    return this.financeService.getTrialBalance(propertyId, fromDate, toDate);
  }

  // ─── Audit Logs ───────────────────────────────────────────────────

  @Get('audit-logs')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'List immutable audit logs — read only' })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listAuditLogs(
    @PropertyId() propertyId: string,
    @Query('entityType') entityType?: string,
    @Query('actorId') actorId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.financeService.listAuditLogs(
      propertyId,
      entityType,
      actorId,
      fromDate,
      toDate,
      (page - 1) * limit,
      limit,
    );
  }

  @Get('audit-logs/:id')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Get a single audit log entry' })
  getAuditLog(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.financeService.getAuditLog(propertyId, id);
  }
}
