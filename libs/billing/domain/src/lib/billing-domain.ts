// ── Branded IDs ───────────────────────────────────────────────────────────────
export type InvoiceId = string & { readonly _brand: 'InvoiceId' };
export type PaymentId = string & { readonly _brand: 'PaymentId' };
export type ClaimId = string & { readonly _brand: 'ClaimId' };
export type FeeScheduleId = string & { readonly _brand: 'FeeScheduleId' };

// ── Enums ─────────────────────────────────────────────────────────────────────
/** Display status, derived from the stored state, balance, and due date. */
export enum InvoiceStatus {
  Draft = 'DRAFT',
  Sent = 'SENT',
  PartiallyPaid = 'PARTIALLY_PAID',
  Paid = 'PAID',
  Overdue = 'OVERDUE',
  Voided = 'VOIDED',
}

export enum PaymentMethod {
  CreditCard = 'CREDIT_CARD',
  DebitCard = 'DEBIT_CARD',
  ACH = 'ACH',
  Cash = 'CASH',
  Check = 'CHECK',
  HSA = 'HSA',
  FSA = 'FSA',
  PatientPortal = 'PATIENT_PORTAL',
  Insurance = 'INSURANCE',
}

export enum ClaimStatus {
  Draft = 'DRAFT',
  Submitted = 'SUBMITTED',
  Pending = 'PENDING',
  Paid = 'PAID',
  Denied = 'DENIED',
  Appealed = 'APPEALED',
  Voided = 'VOIDED',
}

export enum AdjustmentType {
  Writeoff = 'WRITEOFF',
  InsuranceContractual = 'INSURANCE_CONTRACTUAL',
  CourtesyDiscount = 'COURTESY_DISCOUNT',
  BadDebt = 'BAD_DEBT',
  Other = 'OTHER',
}

export type PayerCategory = 'MEDICARE' | 'MEDICAID' | 'PRIVATE' | 'SELF_PAY';

// ── Entities ──────────────────────────────────────────────────────────────────
export interface InvoiceLine {
  readonly id: string;
  readonly serviceCode: string;
  readonly description: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
  readonly totalCents: number;
  readonly notes: string | null;
}

export interface Adjustment {
  readonly id: string;
  readonly type: AdjustmentType;
  readonly amountCents: number;
  readonly reason: string;
  readonly appliedBy: string;
  readonly appliedByName?: string;
  readonly appliedAt: Date;
}

export interface PaymentAllocation {
  readonly invoiceId: InvoiceId;
  readonly invoiceNumber?: string;
  readonly amountCents: number;
}

/** A payment can be split across several invoices; any remainder is patient credit. */
export interface Payment {
  readonly id: PaymentId;
  readonly patientId: string;
  readonly patientName?: string;
  readonly amountCents: number;
  readonly method: PaymentMethod;
  readonly referenceNumber: string | null;
  readonly checkNumber: string | null;
  readonly processedBy: string;
  readonly processedByName?: string;
  readonly processedAt: Date;
  readonly receiptSentTo: string | null;
  readonly voidedAt: Date | null;
  readonly voidReason: string | null;
  readonly allocations: ReadonlyArray<PaymentAllocation>;
  readonly unappliedCents: number;
}

/** A payment as seen from one invoice. */
export interface InvoicePayment {
  readonly paymentId: PaymentId;
  readonly amountCents: number;
  readonly method: PaymentMethod;
  readonly referenceNumber: string | null;
  readonly processedAt: Date;
  readonly processedByName?: string;
  readonly voided: boolean;
}

export interface InsuranceClaim {
  readonly id: ClaimId;
  readonly invoiceId: InvoiceId;
  readonly invoiceNumber?: string;
  readonly patientId: string;
  readonly patientName?: string;
  readonly insurancePolicyId: string;
  readonly payerName: string;
  readonly policyNumber: string;
  readonly billedCents: number;
  readonly status: ClaimStatus;
  readonly submittedAt: Date | null;
  readonly paidAt: Date | null;
  readonly paidAmountCents: number | null;
  readonly denialReason: string | null;
  readonly appealNote: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Invoice aggregate root */
export interface Invoice {
  readonly id: InvoiceId;
  readonly number: string;
  readonly patientId: string;
  readonly encounterId: string | null;
  readonly providerId: string;
  readonly feeScheduleId: FeeScheduleId | null;
  readonly lines: ReadonlyArray<InvoiceLine>;
  readonly adjustments: ReadonlyArray<Adjustment>;
  readonly payments: ReadonlyArray<InvoicePayment>;
  readonly status: InvoiceStatus;
  readonly serviceDate: Date;
  readonly issuedAt: Date | null;
  readonly dueDate: Date | null;
  readonly voidedAt: Date | null;
  readonly voidReason: string | null;
  readonly subtotalCents: number;
  readonly totalAdjustmentsCents: number;
  readonly totalPaidCents: number;
  readonly balanceCents: number;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  // Read-model enrichment
  readonly patientName?: string;
  readonly patientDob?: Date;
  readonly patientMrn?: string;
  readonly providerName?: string;
  readonly claims?: ReadonlyArray<InsuranceClaim>;
}

export interface FeeScheduleLine {
  readonly cptCode: string;
  readonly description: string;
  readonly priceCents: number;
}

export interface FeeSchedule {
  readonly id: FeeScheduleId;
  readonly name: string;
  readonly description: string | null;
  readonly lines: ReadonlyArray<FeeScheduleLine>;
  readonly isDefault: boolean;
  readonly isActive: boolean;
  readonly effectiveDate: Date;
}

// ── Billing dashboard read model ──────────────────────────────────────────────
export interface AgingBucketSummary {
  readonly label: string;
  readonly totalCents: number;
  readonly invoiceCount: number;
}

export interface MonthlyRevenue {
  /** YYYY-MM */
  readonly month: string;
  readonly chargedCents: number;
  readonly collectedCents: number;
}

export interface PayerMixEntry {
  readonly category: PayerCategory;
  readonly chargedCents: number;
  readonly share: number;
}

export interface BillingSummary {
  readonly totalArCents: number;
  /** Outstanding balance 30 days ago, for the trend indicator. */
  readonly arThirtyDaysAgoCents: number;
  readonly collectedTodayCents: number;
  readonly paymentsToday: number;
  /** Average daily collections over the last 30 days. */
  readonly averageDailyCollectionsCents: number;
  readonly aging: ReadonlyArray<AgingBucketSummary>;
  readonly revenueTrend: ReadonlyArray<MonthlyRevenue>;
  readonly payerMix: ReadonlyArray<PayerMixEntry>;
  readonly draftCount: number;
  readonly overdueCount: number;
  readonly openClaims: number;
  readonly recentInvoices: ReadonlyArray<Invoice>;
}

export interface PatientStatement {
  readonly patientId: string;
  readonly patientName: string;
  readonly patientMrn: string;
  readonly address: string | null;
  readonly generatedAt: Date;
  readonly invoices: ReadonlyArray<Invoice>;
  readonly totalBalanceCents: number;
  readonly creditCents: number;
}

// ── Domain Events ─────────────────────────────────────────────────────────────
export interface InvoiceGeneratedEvent {
  readonly type: 'billing.InvoiceGenerated';
  readonly invoiceId: InvoiceId;
  readonly patientId: string;
  readonly encounterId: string | null;
  readonly balanceCents: number;
  readonly timestamp: Date;
}

export interface PaymentReceivedEvent {
  readonly type: 'billing.PaymentReceived';
  readonly paymentId: PaymentId;
  readonly patientId: string;
  readonly amountCents: number;
  readonly method: PaymentMethod;
  readonly timestamp: Date;
}

export type BillingDomainEvent = InvoiceGeneratedEvent | PaymentReceivedEvent;

export interface InvoiceFilters {
  patientId?: string;
  providerId?: string;
  status?: InvoiceStatus | InvoiceStatus[];
  dateRange?: { from: Date; to: Date };
  search?: string;
  limit?: number;
  offset?: number;
}

// ── Business rules ────────────────────────────────────────────────────────────
export const INVOICE_DUE_DAYS = 30;

export const AGING_BUCKETS: ReadonlyArray<{ label: string; from: number; to: number | null }> = [
  { label: '0-30 days', from: 0, to: 30 },
  { label: '31-60 days', from: 31, to: 60 },
  { label: '61-90 days', from: 61, to: 90 },
  { label: '90+ days', from: 91, to: null },
];

export interface InvoiceTotals {
  readonly subtotalCents: number;
  readonly totalAdjustmentsCents: number;
  readonly totalPaidCents: number;
  readonly balanceCents: number;
}

export function computeInvoiceTotals(
  lines: ReadonlyArray<Pick<InvoiceLine, 'totalCents'>>,
  adjustments: ReadonlyArray<Pick<Adjustment, 'amountCents'>>,
  paidCents: number,
): InvoiceTotals {
  const subtotalCents = lines.reduce((sum, l) => sum + l.totalCents, 0);
  const totalAdjustmentsCents = adjustments.reduce((sum, a) => sum + a.amountCents, 0);
  return {
    subtotalCents,
    totalAdjustmentsCents,
    totalPaidCents: paidCents,
    balanceCents: subtotalCents - totalAdjustmentsCents - paidCents,
  };
}

export function deriveInvoiceStatus(
  invoice: { issuedAt: Date | null; voidedAt: Date | null; dueDate: Date | null; totalPaidCents: number; balanceCents: number },
  now: Date = new Date(),
): InvoiceStatus {
  if (invoice.voidedAt) return InvoiceStatus.Voided;
  if (!invoice.issuedAt) return InvoiceStatus.Draft;
  if (invoice.balanceCents <= 0) return InvoiceStatus.Paid;
  if (invoice.dueDate && invoice.dueDate.getTime() < now.getTime()) return InvoiceStatus.Overdue;
  if (invoice.totalPaidCents > 0) return InvoiceStatus.PartiallyPaid;
  return InvoiceStatus.Sent;
}

/** Only issued, unpaid, non-voided invoices accept payments and adjustments. */
export function isInvoiceOpen(status: InvoiceStatus): boolean {
  return status === InvoiceStatus.Sent || status === InvoiceStatus.PartiallyPaid || status === InvoiceStatus.Overdue;
}

/**
 * Splits a payment across open invoices, oldest first (or in the order given when the
 * payer picked specific invoices). Anything left over becomes unapplied patient credit.
 */
export function allocatePayment(
  amountCents: number,
  openInvoices: ReadonlyArray<{ id: string; balanceCents: number }>,
): { allocations: Array<{ invoiceId: string; amountCents: number }>; unappliedCents: number } {
  let remaining = amountCents;
  const allocations: Array<{ invoiceId: string; amountCents: number }> = [];
  for (const inv of openInvoices) {
    if (remaining <= 0) break;
    if (inv.balanceCents <= 0) continue;
    const applied = Math.min(remaining, inv.balanceCents);
    allocations.push({ invoiceId: inv.id, amountCents: applied });
    remaining -= applied;
  }
  return { allocations, unappliedCents: remaining };
}

/** Index into AGING_BUCKETS for an invoice issued on `issuedAt`. */
export function agingBucketIndex(issuedAt: Date, now: Date = new Date()): number {
  const days = Math.floor((now.getTime() - issuedAt.getTime()) / 86_400_000);
  const index = AGING_BUCKETS.findIndex(b => days >= b.from && (b.to === null || days <= b.to));
  return index === -1 ? 0 : index;
}

/** Groups a primary insurance plan name into a payer category; no plan means self-pay. */
export function payerCategory(planName: string | null | undefined): PayerCategory {
  if (!planName) return 'SELF_PAY';
  const name = planName.toLowerCase();
  if (name.includes('medicare')) return 'MEDICARE';
  if (name.includes('medicaid') || name.includes('oregon health plan')) return 'MEDICAID';
  return 'PRIVATE';
}

export function formatInvoiceNumber(sequence: number): string {
  return `INV-${String(sequence).padStart(6, '0')}`;
}

/** Allowed manual claim status transitions (PRD §4.5: Draft → Submitted → Paid / Denied / Pending). */
export const CLAIM_TRANSITIONS: Readonly<Record<ClaimStatus, ReadonlyArray<ClaimStatus>>> = {
  [ClaimStatus.Draft]: [ClaimStatus.Submitted, ClaimStatus.Voided],
  [ClaimStatus.Submitted]: [ClaimStatus.Pending, ClaimStatus.Paid, ClaimStatus.Denied, ClaimStatus.Voided],
  [ClaimStatus.Pending]: [ClaimStatus.Paid, ClaimStatus.Denied, ClaimStatus.Voided],
  [ClaimStatus.Denied]: [ClaimStatus.Appealed, ClaimStatus.Voided],
  [ClaimStatus.Appealed]: [ClaimStatus.Pending, ClaimStatus.Paid, ClaimStatus.Denied, ClaimStatus.Voided],
  [ClaimStatus.Paid]: [],
  [ClaimStatus.Voided]: [],
};
