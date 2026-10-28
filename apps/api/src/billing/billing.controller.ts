import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.service';
import { AuditAction } from '@clinova/identity/domain';
import { full, Permit, read, write } from '../auth/decorators/permit.decorator';
import { Audited } from '../audit/audited';
import { DashboardQueryDto } from '../reporting/dashboard.controller';
import { InvoicesService } from './invoices.service';
import { ClaimsService } from './claims.service';
import { FeeSchedulesService } from './fee-schedules.service';
import { BillingSummaryService } from './billing-summary.service';
import {
  AdjustmentDto,
  CreateClaimDto,
  CreateInvoiceDto,
  SaveFeeScheduleDto,
  TakePaymentDto,
  UpdateClaimDto,
  UpdateDraftDto,
  VoidDto,
} from './dto/billing.dto';

type AuthedRequest = { user: AuthUser };

@ApiTags('billing')
@ApiBearerAuth()
// PRD §3.2 — Invoices & payments: Admin/Billing full, Doctor read, Front desk limited (collect payments).
@Permit(full('billing:invoices'))
@Controller()
export class BillingController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly claims: ClaimsService,
    private readonly feeSchedules: FeeSchedulesService,
    private readonly summary: BillingSummaryService,
  ) {}

  // ── Dashboard & statements ─────────────────────────────────────────────────

  @Get('billing/summary')
  @ApiOperation({ summary: 'Billing dashboard: AR, aging, collections, revenue trend, payer mix' })
  getSummary(@Query() query: DashboardQueryDto) {
    return this.summary.getSummary(query);
  }

  @Get('billing/statements/:patientId')
  @Permit(write('billing:invoices'))
  @Audited({ action: AuditAction.View, resourceType: 'Statement', resourceId: req => req.params['patientId'], patientId: req => req.params['patientId'] })
  @ApiOperation({ summary: 'Patient statement of open invoices' })
  statement(@Param('patientId') patientId: string) {
    return this.invoices.statement(patientId);
  }

  // ── Invoices ───────────────────────────────────────────────────────────────

  @Get('invoices')
  @Permit(read('billing:invoices'))
  @ApiOperation({ summary: 'List invoices (status is derived, e.g. OVERDUE)' })
  findMany(
    @Query('patientId') patientId?: string,
    @Query('providerId') providerId?: string,
    @Query('status') status?: string | string[],
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.invoices.findMany({
      patientId, providerId, status, search, from, to,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('invoices/by-encounter/:encounterId')
  @Permit(read('billing:invoices'))
  findByEncounter(@Param('encounterId') encounterId: string) {
    return this.invoices.findByEncounter(encounterId);
  }

  @Get('invoices/:id')
  @Permit(read('billing:invoices'))
  @Audited({ action: AuditAction.View, resourceType: 'Invoice' })
  findById(@Param('id') id: string) {
    return this.invoices.findById(id);
  }

  @Post('invoices')
  @ApiOperation({ summary: 'Create a draft invoice' })
  create(@Body() dto: CreateInvoiceDto, @Request() req: AuthedRequest) {
    return this.invoices.createDraft(dto, req.user);
  }

  @Post('invoices/from-encounter/:encounterId')
  @ApiOperation({ summary: 'Draft an invoice for a signed encounter (idempotent)' })
  fromEncounter(@Param('encounterId') encounterId: string) {
    return this.invoices.createFromEncounter(encounterId);
  }

  @Patch('invoices/:id')
  @ApiOperation({ summary: 'Edit a draft invoice' })
  updateDraft(@Param('id') id: string, @Body() dto: UpdateDraftDto) {
    return this.invoices.updateDraft(id, dto);
  }

  @Post('invoices/:id/issue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Issue a draft invoice (sets due date)' })
  issue(@Param('id') id: string) {
    return this.invoices.issue(id);
  }

  @Post('invoices/:id/void')
  @HttpCode(HttpStatus.OK)
  void(@Param('id') id: string, @Body() dto: VoidDto, @Request() req: AuthedRequest) {
    return this.invoices.void(id, dto.reason, req.user);
  }

  @Post('invoices/:id/adjustments')
  @ApiOperation({ summary: 'Apply a write-off, discount, or contractual adjustment' })
  addAdjustment(@Param('id') id: string, @Body() dto: AdjustmentDto, @Request() req: AuthedRequest) {
    return this.invoices.addAdjustment(id, dto, req.user);
  }

  // ── Payments ───────────────────────────────────────────────────────────────

  @Get('payments')
  @Permit(write('billing:invoices'))
  listPayments(@Query('patientId') patientId?: string, @Query('limit') limit?: string) {
    return this.invoices.listPayments({ patientId, limit: limit ? parseInt(limit, 10) : undefined });
  }

  @Post('payments')
  @Permit(write('billing:invoices'))
  @Audited({ action: AuditAction.Create, resourceType: 'Payment' })
  @ApiOperation({ summary: 'Take a payment; applied to open invoices oldest-first unless invoiceIds are given' })
  takePayment(@Body() dto: TakePaymentDto, @Request() req: AuthedRequest) {
    return this.invoices.takePayment(dto, req.user);
  }

  @Post('payments/:id/void')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Void a payment (admin/billing approval)' })
  voidPayment(@Param('id') id: string, @Body() dto: VoidDto, @Request() req: AuthedRequest) {
    return this.invoices.voidPayment(id, dto.reason, req.user);
  }

  // ── Claims ─────────────────────────────────────────────────────────────────

  @Get('claims')
  listClaims(@Query('status') status?: string | string[], @Query('patientId') patientId?: string) {
    return this.claims.findMany({ status, patientId });
  }

  @Post('claims')
  createClaim(@Body() dto: CreateClaimDto) {
    return this.claims.create(dto);
  }

  @Patch('claims/:id')
  @ApiOperation({ summary: 'Move a claim through its status pipeline; PAID records the insurer payment' })
  updateClaim(@Param('id') id: string, @Body() dto: UpdateClaimDto, @Request() req: AuthedRequest) {
    return this.claims.update(id, dto, req.user);
  }

  // ── Fee schedules ──────────────────────────────────────────────────────────

  @Get('fee-schedules')
  @Permit(read('billing:invoices'))
  listFeeSchedules(@Query('activeOnly') activeOnly?: string) {
    return this.feeSchedules.findAll(activeOnly !== 'false');
  }

  @Get('fee-schedules/:id')
  @Permit(read('billing:invoices'))
  getFeeSchedule(@Param('id') id: string) {
    return this.feeSchedules.findById(id);
  }

  @Post('fee-schedules')
  @Permit(write('system:settings'))
  createFeeSchedule(@Body() dto: SaveFeeScheduleDto) {
    return this.feeSchedules.create(dto);
  }

  @Put('fee-schedules/:id')
  @Permit(write('system:settings'))
  updateFeeSchedule(@Param('id') id: string, @Body() dto: SaveFeeScheduleDto) {
    return this.feeSchedules.update(id, dto);
  }
}
