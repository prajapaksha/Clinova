import type {
  InsuranceClaim as ClaimRow,
  Invoice as InvoiceRow,
  Payment as PaymentRow,
  PaymentAllocation as AllocationRow,
  Prisma,
} from '@prisma/client';
import type {
  Adjustment,
  ClaimId,
  FeeScheduleId,
  InsuranceClaim,
  Invoice,
  InvoiceId,
  InvoiceLine,
  InvoicePayment,
  Payment,
  PaymentId,
} from '@clinova/billing/domain';
import { ClaimStatus, PaymentMethod, computeInvoiceTotals, deriveInvoiceStatus } from '@clinova/billing/domain';

export const INVOICE_INCLUDE = {
  allocations: { include: { payment: true } },
  claims: true,
} satisfies Prisma.InvoiceInclude;

export type InvoiceWithRelations = InvoiceRow & {
  allocations: Array<AllocationRow & { payment: PaymentRow }>;
  claims: ClaimRow[];
};

export interface PatientSummary {
  name: string;
  mrn: string;
  dob: Date;
}

export interface NameLookup {
  patients: Map<string, PatientSummary>;
  staff: Map<string, string>;
}

/** Sum of non-voided payment allocations on an invoice. */
export function paidCents(row: Pick<InvoiceWithRelations, 'allocations'>): number {
  return row.allocations.filter(a => !a.payment.voidedAt).reduce((sum, a) => sum + a.amountCents, 0);
}

export function parseLines(row: Pick<InvoiceRow, 'linesJson'>): InvoiceLine[] {
  return JSON.parse(row.linesJson);
}

export function parseAdjustments(row: Pick<InvoiceRow, 'adjustmentsJson'>): Adjustment[] {
  return (JSON.parse(row.adjustmentsJson) as Array<Adjustment & { appliedAt: string }>).map(a => ({
    ...a,
    appliedAt: new Date(a.appliedAt),
  }));
}

export function invoiceTotals(row: InvoiceWithRelations) {
  return computeInvoiceTotals(parseLines(row), parseAdjustments(row), paidCents(row));
}

export function invoiceStatus(row: InvoiceWithRelations, now = new Date()) {
  return deriveInvoiceStatus({ ...row, ...invoiceTotals(row) }, now);
}

export function toClaim(row: ClaimRow, names?: NameLookup, invoiceNumber?: string): InsuranceClaim {
  return {
    id: row.id as ClaimId,
    invoiceId: row.invoiceId as InvoiceId,
    invoiceNumber,
    patientId: row.patientId,
    patientName: names?.patients.get(row.patientId)?.name,
    insurancePolicyId: row.insurancePolicyId,
    payerName: row.payerName,
    policyNumber: row.policyNumber,
    billedCents: row.billedCents,
    status: row.status as ClaimStatus,
    submittedAt: row.submittedAt,
    paidAt: row.paidAt,
    paidAmountCents: row.paidAmountCents,
    denialReason: row.denialReason,
    appealNote: row.appealNote,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toInvoice(row: InvoiceWithRelations, names: NameLookup, now = new Date()): Invoice {
  const totals = invoiceTotals(row);
  const patient = names.patients.get(row.patientId);
  const payments: InvoicePayment[] = [...row.allocations]
    .sort((a, b) => a.payment.processedAt.getTime() - b.payment.processedAt.getTime())
    .map(a => ({
      paymentId: a.paymentId as PaymentId,
      amountCents: a.amountCents,
      method: a.payment.method as PaymentMethod,
      referenceNumber: a.payment.referenceNumber ?? a.payment.checkNumber,
      processedAt: a.payment.processedAt,
      processedByName: names.staff.get(a.payment.processedBy),
      voided: !!a.payment.voidedAt,
    }));

  return {
    id: row.id as InvoiceId,
    number: row.number,
    patientId: row.patientId,
    encounterId: row.encounterId,
    providerId: row.providerId,
    feeScheduleId: row.feeScheduleId as FeeScheduleId | null,
    lines: parseLines(row),
    adjustments: parseAdjustments(row).map(a => ({ ...a, appliedByName: names.staff.get(a.appliedBy) })),
    payments,
    status: deriveInvoiceStatus({ ...row, ...totals }, now),
    serviceDate: row.serviceDate,
    issuedAt: row.issuedAt,
    dueDate: row.dueDate,
    voidedAt: row.voidedAt,
    voidReason: row.voidReason,
    ...totals,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    patientName: patient?.name,
    patientDob: patient?.dob,
    patientMrn: patient?.mrn,
    providerName: names.staff.get(row.providerId),
    claims: row.claims.map(c => toClaim(c, names, row.number)),
  };
}

export function toPayment(
  row: PaymentRow & { allocations: Array<AllocationRow & { invoice?: { number: string } }> },
  names?: NameLookup,
): Payment {
  const allocated = row.allocations.reduce((sum, a) => sum + a.amountCents, 0);
  return {
    id: row.id as PaymentId,
    patientId: row.patientId,
    patientName: names?.patients.get(row.patientId)?.name,
    amountCents: row.amountCents,
    method: row.method as PaymentMethod,
    referenceNumber: row.referenceNumber,
    checkNumber: row.checkNumber,
    processedBy: row.processedBy,
    processedByName: names?.staff.get(row.processedBy),
    processedAt: row.processedAt,
    receiptSentTo: row.receiptSentTo,
    voidedAt: row.voidedAt,
    voidReason: row.voidReason,
    allocations: row.allocations.map(a => ({
      invoiceId: a.invoiceId as InvoiceId,
      invoiceNumber: a.invoice?.number,
      amountCents: a.amountCents,
    })),
    unappliedCents: row.amountCents - allocated,
  };
}
