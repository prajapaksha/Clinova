import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import type {
  Adjustment,
  Invoice,
  InvoiceLine,
  Payment,
  PaymentId,
  PaymentReceivedEvent,
  PatientStatement,
} from '@clinova/billing/domain';
import {
  INVOICE_DUE_DAYS,
  InvoiceStatus,
  PaymentMethod,
  allocatePayment,
  formatInvoiceNumber,
  isInvoiceOpen,
} from '@clinova/billing/domain';
import type { EncounterSignedEvent } from '@clinova/clinical/domain';
import type { Address } from '@clinova/patient/domain';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.service';
import { DomainEventBus } from '../events/domain-event-bus';
import {
  INVOICE_INCLUDE,
  InvoiceWithRelations,
  NameLookup,
  invoiceStatus,
  invoiceTotals,
  parseAdjustments,
  toInvoice,
  toPayment,
} from './billing.mapper';
import { FeeSchedulesService } from './fee-schedules.service';
import {
  AdjustmentDto,
  CreateInvoiceDto,
  InvoiceLineInputDto,
  TakePaymentDto,
  UpdateDraftDto,
} from './dto/billing.dto';

export interface InvoiceListFilters {
  patientId?: string;
  providerId?: string;
  status?: string | string[];
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

type Tx = Prisma.TransactionClient;

const DAY_MS = 86_400_000;

function paymentEvent(p: { id: string; patientId: string; amountCents: number; method: string; processedAt: Date }): PaymentReceivedEvent {
  return {
    type: 'billing.PaymentReceived',
    paymentId: p.id as PaymentId,
    patientId: p.patientId,
    amountCents: p.amountCents,
    method: p.method as PaymentMethod,
    timestamp: p.processedAt,
  };
}

@Injectable()
export class InvoicesService implements OnModuleInit {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly feeSchedules: FeeSchedulesService,
    @Optional() private readonly events?: DomainEventBus,
  ) {}

  onModuleInit(): void {
    // Signed notes become draft invoices for billing review (PRD §4.5).
    this.events?.on<EncounterSignedEvent>('clinical.EncounterSigned', async event => {
      const invoice = await this.createFromEncounter(event.encounterId);
      this.logger.log(`Drafted ${invoice.number} for encounter ${event.encounterId}`);
    });
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  async findMany(filters: InvoiceListFilters, now = new Date()): Promise<{ invoices: Invoice[]; total: number }> {
    const where: Prisma.InvoiceWhereInput = {};
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.providerId) where.providerId = filters.providerId;
    if (filters.from || filters.to) {
      where.serviceDate = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }
    const search = filters.search?.trim();
    if (search) {
      const patients = await this.prisma.patient.findMany({
        where: { OR: [{ firstName: { contains: search } }, { lastName: { contains: search } }, { mrn: { contains: search } }] },
        select: { id: true },
      });
      where.OR = [{ number: { contains: search.toUpperCase() } }, { patientId: { in: patients.map(p => p.id) } }];
    }

    const rows = await this.prisma.invoice.findMany({
      where,
      include: INVOICE_INCLUDE,
      orderBy: [{ serviceDate: 'desc' }, { createdAt: 'desc' }],
    });

    // Status is derived (overdue depends on today), so filter after mapping.
    const statuses = filters.status ? (Array.isArray(filters.status) ? filters.status : [filters.status]) : null;
    const matching = statuses ? rows.filter(r => statuses.includes(invoiceStatus(r, now))) : rows;
    const offset = filters.offset ?? 0;
    const page = matching.slice(offset, offset + Math.min(filters.limit ?? 50, 200));
    const names = await this.names(page);
    return { invoices: page.map(r => toInvoice(r, names, now)), total: matching.length };
  }

  async findById(id: string): Promise<Invoice> {
    const row = await this.getRow(id);
    return toInvoice(row, await this.names([row]));
  }

  async findByEncounter(encounterId: string): Promise<Invoice | null> {
    const row = await this.prisma.invoice.findUnique({ where: { encounterId }, include: INVOICE_INCLUDE });
    return row ? toInvoice(row, await this.names([row])) : null;
  }

  // ── Invoice lifecycle ──────────────────────────────────────────────────────

  async createDraft(dto: CreateInvoiceDto, user: AuthUser): Promise<Invoice> {
    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId }, select: { id: true } });
    if (!patient) throw new NotFoundException(`Patient ${dto.patientId} not found`);
    const providerId = dto.providerId ?? user.id;
    const schedule = await this.feeSchedules.resolve(dto.feeScheduleId);
    const lines = this.priceLines(dto.lines, schedule?.lines ?? []);

    const row = await this.prisma.$transaction(async tx => tx.invoice.create({
      data: {
        number: await this.nextNumber(tx),
        patientId: dto.patientId,
        providerId,
        feeScheduleId: schedule?.id ?? null,
        serviceDate: dto.serviceDate ? new Date(dto.serviceDate) : new Date(),
        linesJson: JSON.stringify(lines),
        notes: dto.notes ?? null,
      },
    }));
    return this.findById(row.id);
  }

  /**
   * Drafts an invoice for a signed encounter (idempotent). Lines come from the
   * encounter's service codes, else the appointment type's default code.
   */
  async createFromEncounter(encounterId: string): Promise<Invoice> {
    const existing = await this.findByEncounter(encounterId);
    if (existing) return existing;

    const encounter = await this.prisma.encounter.findUnique({ where: { id: encounterId } });
    if (!encounter) throw new NotFoundException(`Encounter ${encounterId} not found`);
    if (encounter.status !== 'SIGNED' && encounter.status !== 'AMENDED') {
      throw new BadRequestException('Only signed encounters can be billed.');
    }

    const codes: string[] = (JSON.parse(encounter.serviceCodesJson) as Array<{ code: string }>).map(c => c.code);
    let serviceDate = encounter.createdAt;
    if (!codes.length && encounter.appointmentId) {
      const appt = await this.prisma.appointment.findUnique({
        where: { id: encounter.appointmentId },
        include: { appointmentType: true },
      });
      if (appt?.appointmentType.defaultServiceCode) codes.push(appt.appointmentType.defaultServiceCode);
      if (appt) serviceDate = appt.slotStart;
    }

    const schedule = await this.feeSchedules.resolve();
    const lines = this.priceLines(codes.map(code => ({ serviceCode: code, quantity: 1 })), schedule?.lines ?? []);

    const row = await this.prisma.$transaction(async tx => tx.invoice.create({
      data: {
        number: await this.nextNumber(tx),
        patientId: encounter.patientId,
        providerId: encounter.providerId,
        encounterId,
        feeScheduleId: schedule?.id ?? null,
        serviceDate,
        linesJson: JSON.stringify(lines),
        notes: lines.length ? null : 'No billable service codes found — add lines before issuing.',
      },
    }));
    return this.findById(row.id);
  }

  async updateDraft(id: string, dto: UpdateDraftDto): Promise<Invoice> {
    const row = await this.getRow(id);
    if (invoiceStatus(row) !== InvoiceStatus.Draft) {
      throw new ConflictException('Only draft invoices can be edited. Use an adjustment for issued invoices.');
    }
    const data: Prisma.InvoiceUpdateInput = {};
    if (dto.lines) {
      const schedule = await this.feeSchedules.resolve(row.feeScheduleId);
      data.linesJson = JSON.stringify(this.priceLines(dto.lines, schedule?.lines ?? []));
    }
    if (dto.notes !== undefined) data.notes = dto.notes;
    await this.prisma.invoice.update({ where: { id }, data });
    return this.findById(id);
  }

  async issue(id: string, now = new Date()): Promise<Invoice> {
    const row = await this.getRow(id);
    if (invoiceStatus(row, now) !== InvoiceStatus.Draft) throw new ConflictException('This invoice has already been issued.');
    if (invoiceTotals(row).subtotalCents <= 0) throw new BadRequestException('Add at least one billable line before issuing.');

    await this.prisma.invoice.update({
      where: { id },
      data: { issuedAt: now, dueDate: new Date(now.getTime() + INVOICE_DUE_DAYS * DAY_MS) },
    });
    return this.findById(id);
  }

  async void(id: string, reason: string, user: AuthUser): Promise<Invoice> {
    const row = await this.getRow(id);
    const status = invoiceStatus(row);
    if (status === InvoiceStatus.Voided) throw new ConflictException('This invoice is already voided.');
    if (invoiceTotals(row).totalPaidCents > 0) {
      throw new ConflictException('Invoices with payments cannot be voided. Void the payments first or issue a credit adjustment.');
    }
    await this.prisma.invoice.update({
      where: { id },
      data: { voidedAt: new Date(), voidReason: `${reason.trim()} (by ${user.firstName} ${user.lastName})` },
    });
    return this.findById(id);
  }

  async addAdjustment(id: string, dto: AdjustmentDto, user: AuthUser): Promise<Invoice> {
    const row = await this.getRow(id);
    const status = invoiceStatus(row);
    if (!isInvoiceOpen(status)) {
      throw new ConflictException(status === InvoiceStatus.Paid
        ? 'Paid invoices are locked. Corrections require a credit memo.'
        : 'Adjustments can only be applied to issued, unpaid invoices.');
    }
    if (dto.amountCents > invoiceTotals(row).balanceCents) {
      throw new BadRequestException('The adjustment cannot exceed the remaining balance.');
    }
    const adjustment: Adjustment = {
      id: randomUUID(),
      type: dto.type,
      amountCents: dto.amountCents,
      reason: dto.reason.trim(),
      appliedBy: user.id,
      appliedAt: new Date(),
    };
    await this.prisma.invoice.update({
      where: { id },
      data: { adjustmentsJson: JSON.stringify([...parseAdjustments(row), adjustment]) },
    });
    return this.findById(id);
  }

  // ── Payments ───────────────────────────────────────────────────────────────

  async takePayment(dto: TakePaymentDto, user: AuthUser): Promise<Payment> {
    if (dto.method === PaymentMethod.Check && !dto.checkNumber?.trim()) {
      throw new BadRequestException('A check number is required for check payments.');
    }
    const patient = await this.prisma.patient.findUnique({ where: { id: dto.patientId }, select: { id: true } });
    if (!patient) throw new NotFoundException(`Patient ${dto.patientId} not found`);
    const open = await this.openInvoices(dto.patientId);
    let targets = open;
    if (dto.invoiceIds?.length) {
      targets = dto.invoiceIds.map(id => {
        const inv = open.find(o => o.id === id);
        if (!inv) throw new BadRequestException(`Invoice ${id} is not open for this patient.`);
        return inv;
      });
    }
    const { allocations } = allocatePayment(dto.amountCents, targets);

    const payment = await this.prisma.payment.create({
      data: {
        patientId: dto.patientId,
        amountCents: dto.amountCents,
        method: dto.method,
        referenceNumber: dto.referenceNumber?.trim() || null,
        checkNumber: dto.checkNumber?.trim() || null,
        processedBy: user.id,
        receiptSentTo: dto.receiptEmail ?? null,
        allocations: { create: allocations.map(a => ({ invoiceId: a.invoiceId, amountCents: a.amountCents })) },
      },
      include: { allocations: { include: { invoice: { select: { number: true } } } } },
    });
    this.events?.publish(paymentEvent(payment));
    return toPayment(payment, await this.namesFor([dto.patientId], [user.id]));
  }

  /** Records an insurer's payment against one invoice (used by claims); any excess stays as credit. */
  async recordInsurancePayment(
    tx: Tx,
    args: { invoiceId: string; patientId: string; amountCents: number; allocateCents: number; payer: string },
    user: AuthUser,
  ) {
    return tx.payment.create({
      data: {
        patientId: args.patientId,
        amountCents: args.amountCents,
        method: PaymentMethod.Insurance,
        referenceNumber: args.payer,
        processedBy: user.id,
        allocations: args.allocateCents > 0 ? { create: [{ invoiceId: args.invoiceId, amountCents: args.allocateCents }] } : undefined,
      },
    });
  }

  async voidPayment(id: string, reason: string, user: AuthUser): Promise<Payment> {
    const row = await this.prisma.payment.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Payment ${id} not found`);
    if (row.voidedAt) throw new ConflictException('This payment is already voided.');
    const updated = await this.prisma.payment.update({
      where: { id },
      data: { voidedAt: new Date(), voidReason: `${reason.trim()} (by ${user.firstName} ${user.lastName})` },
      include: { allocations: { include: { invoice: { select: { number: true } } } } },
    });
    return toPayment(updated, await this.namesFor([row.patientId], [row.processedBy]));
  }

  async listPayments(filters: { patientId?: string; limit?: number }): Promise<Payment[]> {
    const rows = await this.prisma.payment.findMany({
      where: filters.patientId ? { patientId: filters.patientId } : undefined,
      include: { allocations: { include: { invoice: { select: { number: true } } } } },
      orderBy: { processedAt: 'desc' },
      take: Math.min(filters.limit ?? 50, 200),
    });
    const names = await this.namesFor(rows.map(r => r.patientId), rows.map(r => r.processedBy));
    return rows.map(r => toPayment(r, names));
  }

  async statement(patientId: string, now = new Date()): Promise<PatientStatement> {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException(`Patient ${patientId} not found`);

    const { invoices } = await this.findMany({ patientId, status: [InvoiceStatus.Sent, InvoiceStatus.PartiallyPaid, InvoiceStatus.Overdue], limit: 200 }, now);
    const payments = await this.prisma.payment.findMany({
      where: { patientId, voidedAt: null },
      include: { allocations: true },
    });
    const creditCents = payments.reduce((sum, p) => sum + p.amountCents - p.allocations.reduce((s, a) => s + a.amountCents, 0), 0);
    const contact = JSON.parse(patient.contactJson) as { billingAddress: Address | null; mailingAddress: Address };
    const addr = contact.billingAddress ?? contact.mailingAddress;

    return {
      patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      patientMrn: patient.mrn,
      address: addr ? [addr.street1, addr.street2, `${addr.city}, ${addr.state} ${addr.postalCode}`].filter(Boolean).join('\n') : null,
      generatedAt: now,
      invoices: [...invoices].reverse(),
      totalBalanceCents: invoices.reduce((sum, i) => sum + i.balanceCents, 0),
      creditCents,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  async getRow(id: string): Promise<InvoiceWithRelations> {
    const row = await this.prisma.invoice.findUnique({ where: { id }, include: INVOICE_INCLUDE });
    if (!row) throw new NotFoundException(`Invoice ${id} not found`);
    return row;
  }

  /** Open invoices for a patient, oldest first, with current balances. */
  private async openInvoices(patientId: string): Promise<Array<{ id: string; balanceCents: number }>> {
    const rows = await this.prisma.invoice.findMany({
      where: { patientId, issuedAt: { not: null }, voidedAt: null },
      include: INVOICE_INCLUDE,
      orderBy: { issuedAt: 'asc' },
    });
    return rows
      .filter(r => isInvoiceOpen(invoiceStatus(r)))
      .map(r => ({ id: r.id, balanceCents: invoiceTotals(r).balanceCents }));
  }

  private priceLines(inputs: InvoiceLineInputDto[], schedule: ReadonlyArray<{ cptCode: string; description: string; priceCents: number }>): InvoiceLine[] {
    return inputs.map(input => {
      const code = input.serviceCode.trim().toUpperCase();
      const fee = schedule.find(l => l.cptCode === code);
      const unitPriceCents = input.unitPriceCents ?? fee?.priceCents;
      if (unitPriceCents === undefined) {
        throw new BadRequestException(`No price for service code ${code}. Add it to the fee schedule or enter a price.`);
      }
      return {
        id: randomUUID(),
        serviceCode: code,
        description: input.description?.trim() || fee?.description || code,
        quantity: input.quantity,
        unitPriceCents,
        totalCents: unitPriceCents * input.quantity,
        notes: input.notes?.trim() || null,
      };
    });
  }

  private async nextNumber(tx: Tx): Promise<string> {
    const counter = await tx.counter.upsert({
      where: { name: 'invoice' },
      create: { name: 'invoice', value: 1 },
      update: { value: { increment: 1 } },
    });
    return formatInvoiceNumber(counter.value);
  }

  async names(rows: InvoiceWithRelations[]): Promise<NameLookup> {
    return this.namesFor(
      rows.map(r => r.patientId),
      rows.flatMap(r => [
        r.providerId,
        ...r.allocations.map(a => a.payment.processedBy),
        ...parseAdjustments(r).map(a => a.appliedBy),
      ]),
    );
  }

  async namesFor(patientIds: string[], staffIds: string[]): Promise<NameLookup> {
    const pIds = [...new Set(patientIds)];
    const sIds = [...new Set(staffIds.filter(Boolean))];
    const [patients, staff] = await Promise.all([
      pIds.length
        ? this.prisma.patient.findMany({
            where: { id: { in: pIds } },
            select: { id: true, firstName: true, lastName: true, mrn: true, dateOfBirth: true },
          })
        : [],
      sIds.length
        ? this.prisma.staff.findMany({ where: { id: { in: sIds } }, select: { id: true, firstName: true, lastName: true, role: true } })
        : [],
    ]);
    return {
      patients: new Map(patients.map(p => [p.id, { name: `${p.firstName} ${p.lastName}`, mrn: p.mrn, dob: p.dateOfBirth }])),
      staff: new Map(staff.map(s => [s.id, `${s.role === 'PHYSICIAN' ? 'Dr. ' : ''}${s.firstName} ${s.lastName}`])),
    };
  }
}
