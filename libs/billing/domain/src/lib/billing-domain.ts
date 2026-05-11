// ── Branded IDs ───────────────────────────────────────────────────────────────
export type InvoiceId = string & { readonly _brand: 'InvoiceId' };
export type PaymentId = string & { readonly _brand: 'PaymentId' };
export type ClaimId = string & { readonly _brand: 'ClaimId' };
export type FeeScheduleId = string & { readonly _brand: 'FeeScheduleId' };

// ── Enums ─────────────────────────────────────────────────────────────────────
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

// ── Value Objects ─────────────────────────────────────────────────────────────
export interface Money {
  readonly amountCents: number;
  readonly currency: string;
}

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
  readonly invoiceId: InvoiceId;
  readonly type: AdjustmentType;
  readonly amountCents: number;
  readonly reason: string;
  readonly appliedBy: string;
  readonly appliedAt: Date;
}

export interface Payment {
  readonly id: PaymentId;
  readonly invoiceId: InvoiceId;
  readonly patientId: string;
  readonly amountCents: number;
  readonly method: PaymentMethod;
  readonly referenceNumber: string | null;
  readonly checkNumber: string | null;
  readonly processedBy: string;
  readonly processedAt: Date;
  readonly receiptSentTo: string | null;
  readonly voidedAt: Date | null;
  readonly voidReason: string | null;
}

export interface InsuranceClaim {
  readonly id: ClaimId;
  readonly invoiceId: InvoiceId;
  readonly patientId: string;
  readonly insurancePolicyId: string;
  readonly status: ClaimStatus;
  readonly submittedAt: Date | null;
  readonly paidAt: Date | null;
  readonly paidAmountCents: number | null;
  readonly denialReason: string | null;
  readonly appealNote: string | null;
  readonly updatedAt: Date;
}

/** Invoice aggregate root */
export interface Invoice {
  readonly id: InvoiceId;
  readonly patientId: string;
  readonly encounterId: string | null;
  readonly providerId: string;
  readonly feeScheduleId: FeeScheduleId | null;
  readonly lines: ReadonlyArray<InvoiceLine>;
  readonly adjustments: ReadonlyArray<Adjustment>;
  readonly payments: ReadonlyArray<Payment>;
  readonly status: InvoiceStatus;
  readonly issuedAt: Date | null;
  readonly dueDate: Date | null;
  readonly subtotalCents: number;
  readonly totalAdjustmentsCents: number;
  readonly totalPaidCents: number;
  readonly balanceCents: number;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
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
  readonly invoiceId: InvoiceId;
  readonly patientId: string;
  readonly amountCents: number;
  readonly method: PaymentMethod;
  readonly timestamp: Date;
}

export interface InvoiceVoidedEvent {
  readonly type: 'billing.InvoiceVoided';
  readonly invoiceId: InvoiceId;
  readonly patientId: string;
  readonly voidedBy: string;
  readonly reason: string;
  readonly timestamp: Date;
}

export interface ClaimSubmittedEvent {
  readonly type: 'billing.ClaimSubmitted';
  readonly claimId: ClaimId;
  readonly invoiceId: InvoiceId;
  readonly insurancePolicyId: string;
  readonly timestamp: Date;
}

export type BillingDomainEvent =
  | InvoiceGeneratedEvent
  | PaymentReceivedEvent
  | InvoiceVoidedEvent
  | ClaimSubmittedEvent;

// ── Repository Interfaces ─────────────────────────────────────────────────────
export interface InvoiceFilters {
  patientId?: string;
  providerId?: string;
  status?: InvoiceStatus | InvoiceStatus[];
  dateRange?: { from: Date; to: Date };
  isOverdue?: boolean;
  limit?: number;
  offset?: number;
}

export interface InvoiceRepository {
  findById(id: InvoiceId): Promise<Invoice | null>;
  findMany(filters: InvoiceFilters): Promise<{ invoices: Invoice[]; total: number }>;
  findByEncounter(encounterId: string): Promise<Invoice | null>;
  save(invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>): Promise<Invoice>;
  update(id: InvoiceId, updates: Partial<Omit<Invoice, 'id' | 'createdAt'>>): Promise<Invoice>;
  void(id: InvoiceId, voidedBy: string, reason: string): Promise<Invoice>;
}

export interface PaymentRepository {
  findById(id: PaymentId): Promise<Payment | null>;
  findByInvoice(invoiceId: InvoiceId): Promise<Payment[]>;
  save(payment: Omit<Payment, 'id'>): Promise<Payment>;
  void(id: PaymentId, reason: string): Promise<Payment>;
}

export interface FeeScheduleRepository {
  findById(id: FeeScheduleId): Promise<FeeSchedule | null>;
  findDefault(): Promise<FeeSchedule | null>;
  findAll(activeOnly?: boolean): Promise<FeeSchedule[]>;
  save(schedule: Omit<FeeSchedule, 'id'>): Promise<FeeSchedule>;
  update(id: FeeScheduleId, updates: Partial<Omit<FeeSchedule, 'id'>>): Promise<FeeSchedule>;
}

export interface InsuranceClaimRepository {
  findById(id: ClaimId): Promise<InsuranceClaim | null>;
  findByInvoice(invoiceId: InvoiceId): Promise<InsuranceClaim[]>;
  findByStatus(status: ClaimStatus): Promise<InsuranceClaim[]>;
  save(claim: Omit<InsuranceClaim, 'id'>): Promise<InsuranceClaim>;
  update(id: ClaimId, updates: Partial<Omit<InsuranceClaim, 'id'>>): Promise<InsuranceClaim>;
}
