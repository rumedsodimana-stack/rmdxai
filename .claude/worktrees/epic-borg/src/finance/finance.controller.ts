import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';

import { FinanceService } from './finance.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateReceiptDto } from './dto/create-receipt.dto';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PropertyId } from '../../common/decorators/property-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // ─────────────────────────────────────────────────────────
  //  CHART OF ACCOUNTS
  // ─────────────────────────────────────────────────────────

  @Get('accounts')
  @ApiOperation({ summary: 'List all active accounts in the chart of accounts' })
  listChartOfAccounts(@PropertyId() propertyId: string) {
    return this.financeService.listChartOfAccounts(propertyId);
  }

  @Get('accounts/:id')
  @ApiOperation({ summary: 'Get a single account with recent journal lines' })
  getAccount(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.financeService.getAccount(propertyId, id);
  }

  // ─────────────────────────────────────────────────────────
  //  JOURNAL ENTRIES — immutable (no PUT/PATCH/DELETE)
  // ─────────────────────────────────────────────────────────

  @Post('journal-entries')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Create an immutable double-entry journal entry' })
  createJournalEntry(
    @PropertyId() propertyId: string,
    @Body() dto: CreateJournalEntryDto,
    @CurrentUser() user: any,
  ) {
    return this.financeService.createJournalEntry(propertyId, dto, user.id);
  }

  @Get('journal-entries')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'List journal entries with optional filters' })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiQuery({ name: 'referenceType', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listJournalEntries(
    @PropertyId() propertyId: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('referenceType') referenceType?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.financeService.listJournalEntries(propertyId, { fromDate, toDate, referenceType, skip, take });
  }

  @Get('journal-entries/:id')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Get a single journal entry with all lines' })
  getJournalEntry(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.financeService.getJournalEntry(propertyId, id);
  }

  @Post('journal-entries/:id/reverse')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Post a reversal entry (journal entries are immutable — corrected by reversal)' })
  reverseJournalEntry(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.financeService.reverseJournalEntry(propertyId, id, user.id);
  }

  // ─────────────────────────────────────────────────────────
  //  INVOICES
  // ─────────────────────────────────────────────────────────

  @Post('invoices')
  @Roles('GM', 'ADMIN', 'FINANCE', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Create a new invoice' })
  createInvoice(
    @PropertyId() propertyId: string,
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: any,
  ) {
    return this.financeService.createInvoice(propertyId, dto, user.id);
  }

  @Get('invoices')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'List invoices with optional status filter' })
  @ApiQuery({ name: 'status', enum: InvoiceStatus, required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listInvoices(
    @PropertyId() propertyId: string,
    @Query('status') status?: InvoiceStatus,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.financeService.listInvoices(propertyId, { status, skip, take });
  }

  @Get('invoices/:id')
  @Roles('GM', 'ADMIN', 'FINANCE', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Get a single invoice with receipts' })
  getInvoice(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.financeService.getInvoice(propertyId, id);
  }

  @Post('invoices/:id/send')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send invoice to guest / company (DRAFT → SENT)' })
  sendInvoice(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.financeService.sendInvoice(propertyId, id, user.id);
  }

  @Post('invoices/:id/finalize')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finalize / mark invoice as paid (balance must be zero)' })
  finalizeInvoice(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.financeService.finalizeInvoice(propertyId, id, user.id);
  }

  @Post('invoices/:id/cancel')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an invoice (cannot cancel PAID invoices)' })
  cancelInvoice(
    @PropertyId() propertyId: string,
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.financeService.cancelInvoice(propertyId, id, user.id);
  }

  // ─────────────────────────────────────────────────────────
  //  RECEIPTS
  // ─────────────────────────────────────────────────────────

  @Post('receipts')
  @Roles('GM', 'ADMIN', 'FINANCE', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Create a receipt, optionally linked to an invoice' })
  createReceipt(
    @PropertyId() propertyId: string,
    @Body() dto: CreateReceiptDto,
    @CurrentUser() user: any,
  ) {
    return this.financeService.createReceipt(propertyId, dto, user.id);
  }

  @Get('receipts')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'List receipts (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listReceipts(
    @PropertyId() propertyId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.financeService.listReceipts(propertyId, { skip, take });
  }

  @Get('receipts/:id')
  @Roles('GM', 'ADMIN', 'FINANCE', 'DEPT_MANAGER')
  @ApiOperation({ summary: 'Get a single receipt' })
  getReceipt(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.financeService.getReceipt(propertyId, id);
  }

  // ─────────────────────────────────────────────────────────
  //  DAILY BALANCE SNAPSHOT
  // ─────────────────────────────────────────────────────────

  @Get('snapshot')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Get daily balance snapshot for a specific date' })
  @ApiQuery({ name: 'date', required: true, type: String, example: '2025-09-30' })
  getDailyBalanceSnapshot(
    @PropertyId() propertyId: string,
    @Query('date') date: string,
  ) {
    return this.financeService.getDailyBalanceSnapshot(propertyId, date);
  }

  // ─────────────────────────────────────────────────────────
  //  AUDIT LOG — read-only
  // ─────────────────────────────────────────────────────────

  @Get('audit-log')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Query the immutable audit log (read-only)' })
  @ApiQuery({ name: 'entityType', required: false, type: String })
  @ApiQuery({ name: 'entityId', required: false, type: String })
  @ApiQuery({ name: 'actorId', required: false, type: String })
  @ApiQuery({ name: 'fromDate', required: false, type: String })
  @ApiQuery({ name: 'toDate', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  listAuditLog(
    @PropertyId() propertyId: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('actorId') actorId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const take = parseInt(limit, 10);
    const skip = (parseInt(page, 10) - 1) * take;
    return this.financeService.listAuditLog(propertyId, { entityType, entityId, actorId, fromDate, toDate, skip, take });
  }

  @Get('audit-log/:id')
  @Roles('GM', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Get a single audit log entry' })
  getAuditLog(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.financeService.getAuditLog(propertyId, id);
  }
}
