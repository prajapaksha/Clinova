import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  AdjustmentType,
  BillingSummary,
  ClaimId,
  ClaimStatus,
  FeeSchedule,
  FeeScheduleId,
  FeeScheduleLine,
  InsuranceClaim,
  Invoice,
  InvoiceFilters,
  InvoiceId,
  PatientStatement,
  Payment,
  PaymentId,
  PaymentMethod,
} from '@clinova/billing/domain';

export interface InvoiceLineInput {
  serviceCode: string;
  quantity: number;
  description?: string;
  /** Defaults to the fee-schedule price. */
  unitPriceCents?: number;
  notes?: string;
}

export interface CreateInvoiceDto {
  patientId: string;
  providerId?: string;
  serviceDate?: string;
  feeScheduleId?: string;
  lines: InvoiceLineInput[];
  notes?: string;
}

export interface TakePaymentDto {
  patientId: string;
  amountCents: number;
  method: PaymentMethod;
  /** Invoices to pay, in order; defaults to all open invoices oldest-first. */
  invoiceIds?: string[];
  referenceNumber?: string;
  checkNumber?: string;
  receiptEmail?: string;
}

export interface ApplyAdjustmentDto {
  type: AdjustmentType;
  amountCents: number;
  reason: string;
}

export interface UpdateClaimDto {
  status: ClaimStatus;
  paidAmountCents?: number;
  contractualAdjustmentCents?: number;
  denialReason?: string;
  appealNote?: string;
}

export interface SaveFeeScheduleDto {
  name: string;
  description?: string;
  lines: FeeScheduleLine[];
  isDefault?: boolean;
  isActive?: boolean;
}

function toHttpParams(filters: InvoiceFilters): HttpParams {
  let p = new HttpParams();
  if (filters.patientId) p = p.set('patientId', filters.patientId);
  if (filters.providerId) p = p.set('providerId', filters.providerId);
  if (filters.search) p = p.set('search', filters.search);
  if (filters.dateRange) {
    p = p.set('from', filters.dateRange.from.toISOString());
    p = p.set('to', filters.dateRange.to.toISOString());
  }
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    statuses.forEach(s => (p = p.append('status', s)));
  }
  if (filters.limit) p = p.set('limit', String(filters.limit));
  if (filters.offset) p = p.set('offset', String(filters.offset));
  return p;
}

/** Local calendar date (YYYY-MM-DD) and offset so the server agrees on "today". */
function localDay(date = new Date()): Record<string, string> {
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    tzOffset: String(date.getTimezoneOffset()),
  };
}

@Injectable({ providedIn: 'root' })
export class BillingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/invoices';

  getSummary(): Observable<BillingSummary> {
    return this.http.get<BillingSummary>('/api/billing/summary', { params: localDay() });
  }

  getStatement(patientId: string): Observable<PatientStatement> {
    return this.http.get<PatientStatement>(`/api/billing/statements/${patientId}`);
  }

  // Invoices
  getInvoices(filters: InvoiceFilters = {}): Observable<{ invoices: Invoice[]; total: number }> {
    return this.http.get<{ invoices: Invoice[]; total: number }>(this.base, { params: toHttpParams(filters) });
  }

  findById(id: InvoiceId | string): Observable<Invoice> {
    return this.http.get<Invoice>(`${this.base}/${id}`);
  }

  findByEncounter(encounterId: string): Observable<Invoice | null> {
    return this.http.get<Invoice | null>(`${this.base}/by-encounter/${encounterId}`);
  }

  create(dto: CreateInvoiceDto): Observable<Invoice> {
    return this.http.post<Invoice>(this.base, dto);
  }

  createFromEncounter(encounterId: string): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.base}/from-encounter/${encounterId}`, {});
  }

  updateDraft(id: InvoiceId, dto: { lines?: InvoiceLineInput[]; notes?: string }): Observable<Invoice> {
    return this.http.patch<Invoice>(`${this.base}/${id}`, dto);
  }

  issue(id: InvoiceId): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.base}/${id}/issue`, {});
  }

  void(id: InvoiceId, reason: string): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.base}/${id}/void`, { reason });
  }

  applyAdjustment(id: InvoiceId, dto: ApplyAdjustmentDto): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.base}/${id}/adjustments`, dto);
  }

  // Payments
  getPayments(filters: { patientId?: string; limit?: number } = {}): Observable<Payment[]> {
    const params: Record<string, string> = {};
    if (filters.patientId) params['patientId'] = filters.patientId;
    if (filters.limit) params['limit'] = String(filters.limit);
    return this.http.get<Payment[]>('/api/payments', { params });
  }

  takePayment(dto: TakePaymentDto): Observable<Payment> {
    return this.http.post<Payment>('/api/payments', dto);
  }

  voidPayment(id: PaymentId, reason: string): Observable<Payment> {
    return this.http.post<Payment>(`/api/payments/${id}/void`, { reason });
  }

  // Claims
  getClaims(filters: { status?: ClaimStatus | ClaimStatus[]; patientId?: string } = {}): Observable<InsuranceClaim[]> {
    let params = new HttpParams();
    if (filters.patientId) params = params.set('patientId', filters.patientId);
    const statuses = filters.status ? (Array.isArray(filters.status) ? filters.status : [filters.status]) : [];
    statuses.forEach(s => (params = params.append('status', s)));
    return this.http.get<InsuranceClaim[]>('/api/claims', { params });
  }

  createClaim(invoiceId: InvoiceId, insurancePolicyId?: string): Observable<InsuranceClaim> {
    return this.http.post<InsuranceClaim>('/api/claims', { invoiceId, insurancePolicyId });
  }

  updateClaim(id: ClaimId, dto: UpdateClaimDto): Observable<InsuranceClaim> {
    return this.http.patch<InsuranceClaim>(`/api/claims/${id}`, dto);
  }

  // Fee schedules
  getProviders(): Observable<Array<{ id: string; firstName: string; lastName: string }>> {
    return this.http.get<Array<{ id: string; firstName: string; lastName: string }>>('/api/staff', { params: { role: 'PHYSICIAN' } });
  }

  getFeeSchedules(activeOnly = true): Observable<FeeSchedule[]> {
    return this.http.get<FeeSchedule[]>('/api/fee-schedules', { params: { activeOnly: String(activeOnly) } });
  }

  createFeeSchedule(dto: SaveFeeScheduleDto): Observable<FeeSchedule> {
    return this.http.post<FeeSchedule>('/api/fee-schedules', dto);
  }

  updateFeeSchedule(id: FeeScheduleId, dto: SaveFeeScheduleDto): Observable<FeeSchedule> {
    return this.http.put<FeeSchedule>(`/api/fee-schedules/${id}`, dto);
  }
}
