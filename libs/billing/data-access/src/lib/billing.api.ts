import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  Invoice, InvoiceId, InvoiceStatus, InvoiceFilters,
  Payment, PaymentId, PaymentMethod,
  InsuranceClaim, ClaimId, ClaimStatus,
  FeeSchedule, FeeScheduleId,
  AdjustmentType,
} from '@clinova/billing/domain';

export interface TakePaymentDto {
  invoiceId: InvoiceId;
  amountCents: number;
  method: PaymentMethod;
  referenceNumber?: string;
  checkNumber?: string;
  receiptEmail?: string;
}

export interface ApplyAdjustmentDto {
  type: AdjustmentType;
  amountCents: number;
  reason: string;
}

function toHttpParams(filters: InvoiceFilters): HttpParams {
  let p = new HttpParams();
  if (filters.patientId) p = p.set('patientId', filters.patientId);
  if (filters.providerId) p = p.set('providerId', filters.providerId);
  if (filters.isOverdue != null) p = p.set('isOverdue', String(filters.isOverdue));
  if (filters.dateRange) {
    p = p.set('from', filters.dateRange.from.toISOString());
    p = p.set('to', filters.dateRange.to.toISOString());
  }
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    statuses.forEach(s => p = p.append('status', s));
  }
  if (filters.limit) p = p.set('limit', String(filters.limit));
  if (filters.offset) p = p.set('offset', String(filters.offset));
  return p;
}

@Injectable({ providedIn: 'root' })
export class BillingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/invoices';

  getInvoices(filters: InvoiceFilters = {}): Observable<{ invoices: Invoice[]; total: number }> {
    return this.http.get<{ invoices: Invoice[]; total: number }>(this.base, { params: toHttpParams(filters) });
  }

  findById(id: InvoiceId): Observable<Invoice> {
    return this.http.get<Invoice>(`${this.base}/${id}`);
  }

  findByEncounter(encounterId: string): Observable<Invoice | null> {
    return this.http.get<Invoice | null>(`${this.base}/by-encounter/${encounterId}`);
  }

  void(id: InvoiceId, reason: string): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.base}/${id}/void`, { reason });
  }

  applyAdjustment(id: InvoiceId, dto: ApplyAdjustmentDto): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.base}/${id}/adjustments`, dto);
  }

  takePayment(dto: TakePaymentDto): Observable<Payment> {
    return this.http.post<Payment>('/api/payments', dto);
  }

  voidPayment(id: PaymentId, reason: string): Observable<Payment> {
    return this.http.post<Payment>(`/api/payments/${id}/void`, { reason });
  }

  getClaims(filters?: { status?: ClaimStatus; patientId?: string }): Observable<InsuranceClaim[]> {
    const params: Record<string, string> = {};
    if (filters?.status) params['status'] = filters.status;
    if (filters?.patientId) params['patientId'] = filters.patientId;
    return this.http.get<InsuranceClaim[]>('/api/claims', { params });
  }

  submitClaim(invoiceId: InvoiceId, insurancePolicyId: string): Observable<InsuranceClaim> {
    return this.http.post<InsuranceClaim>('/api/claims', { invoiceId, insurancePolicyId });
  }

  updateClaim(id: ClaimId, updates: { status?: ClaimStatus; paidAmountCents?: number; denialReason?: string; appealNote?: string }): Observable<InsuranceClaim> {
    return this.http.patch<InsuranceClaim>(`/api/claims/${id}`, updates);
  }

  getFeeSchedules(activeOnly = true): Observable<FeeSchedule[]> {
    return this.http.get<FeeSchedule[]>('/api/fee-schedules', { params: { activeOnly: String(activeOnly) } });
  }

  getFeeScheduleById(id: FeeScheduleId): Observable<FeeSchedule> {
    return this.http.get<FeeSchedule>(`/api/fee-schedules/${id}`);
  }

  saveFeeSchedule(schedule: Omit<FeeSchedule, 'id'>): Observable<FeeSchedule> {
    return this.http.post<FeeSchedule>('/api/fee-schedules', schedule);
  }

  getArAging(): Observable<{ buckets: Array<{ label: string; totalCents: number; invoiceCount: number }>; totalCents: number }> {
    return this.http.get<{ buckets: Array<{ label: string; totalCents: number; invoiceCount: number }>; totalCents: number }>('/api/reports/ar-aging');
  }
}
