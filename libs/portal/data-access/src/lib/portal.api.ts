import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { Invoice, Payment } from '@clinova/billing/domain';
import type {
  AvailabilityDay,
  BookableType,
  HealthSummary,
  NotificationPreferences,
  NOTIFICATION_TOPICS,
  PortalAppointment,
  PortalDashboard,
  PortalDocument,
  PortalProvider,
  ProfileChangeRequest,
  RefillRequest,
  SavedCard,
  Thread,
  ThreadCategory,
  ThreadSummary,
  VisitSummary,
  VisitSummaryListItem,
} from '@clinova/portal/domain';
import type { ContactInfo, EmergencyContact, InsurancePolicy } from '@clinova/patient/domain';

export interface BillingSummary {
  balanceCents: number;
  creditCents: number;
  openInvoiceCount: number;
  oldestDueDate: string | null;
  overdue: boolean;
}

export interface CardInput {
  number: string;
  expMonth: number;
  expYear: number;
  cvc: string;
  cardholderName: string;
}

export interface PayInput {
  amountCents: number;
  invoiceIds?: string[];
  savedCardId?: string;
  card?: CardInput;
  saveCard?: boolean;
}

export interface EditableProfile {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  mrn: string;
  preferredName: string | null;
  pronouns: string | null;
  preferredLanguage: string;
  contact: ContactInfo;
  emergencyContacts: EmergencyContact[];
  insurancePolicies: InsurancePolicy[];
  pendingRequest: ProfileChangeRequest | null;
}

export interface PreferencesResponse {
  topics: typeof NOTIFICATION_TOPICS;
  preferences: NotificationPreferences;
}

/** Patient-facing API (all calls are scoped server-side to the signed-in patient). */
@Injectable({ providedIn: 'root' })
export class PortalApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/portal';

  dashboard(): Observable<PortalDashboard> {
    return this.http.get<PortalDashboard>(`${this.base}/dashboard`);
  }

  // Appointments
  appointments(): Observable<PortalAppointment[]> {
    return this.http.get<PortalAppointment[]>(`${this.base}/appointments`);
  }

  bookableTypes(): Observable<BookableType[]> {
    return this.http.get<BookableType[]>(`${this.base}/booking/types`);
  }

  providers(): Observable<PortalProvider[]> {
    return this.http.get<PortalProvider[]>(`${this.base}/booking/providers`);
  }

  availability(q: { providerId: string; appointmentTypeId: string; from: string; days: number; excludeAppointmentId?: string }): Observable<AvailabilityDay[]> {
    let params = new HttpParams({ fromObject: { ...q, days: q.days, tzOffset: new Date().getTimezoneOffset() } as Record<string, string | number> });
    if (!q.excludeAppointmentId) params = params.delete('excludeAppointmentId');
    return this.http.get<AvailabilityDay[]>(`${this.base}/booking/availability`, { params });
  }

  book(dto: { providerId: string; appointmentTypeId: string; start: string; reasonForVisit?: string }): Observable<PortalAppointment> {
    return this.http.post<PortalAppointment>(`${this.base}/appointments`, { ...dto, tzOffset: new Date().getTimezoneOffset() });
  }

  reschedule(id: string, start: string): Observable<PortalAppointment> {
    return this.http.put<PortalAppointment>(`${this.base}/appointments/${id}`, { start, tzOffset: new Date().getTimezoneOffset() });
  }

  cancel(id: string, note?: string): Observable<PortalAppointment> {
    return this.http.post<PortalAppointment>(`${this.base}/appointments/${id}/cancel`, { note });
  }

  // Records
  visits(): Observable<VisitSummaryListItem[]> {
    return this.http.get<VisitSummaryListItem[]>(`${this.base}/records/visits`);
  }

  visit(id: string): Observable<VisitSummary> {
    return this.http.get<VisitSummary>(`${this.base}/records/visits/${id}`);
  }

  health(): Observable<HealthSummary> {
    return this.http.get<HealthSummary>(`${this.base}/records/health`);
  }

  documents(): Observable<PortalDocument[]> {
    return this.http.get<PortalDocument[]>(`${this.base}/records/documents`);
  }

  documentFile(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/records/documents/${id}/file`, { responseType: 'blob' });
  }

  refills(): Observable<RefillRequest[]> {
    return this.http.get<RefillRequest[]>(`${this.base}/refills`);
  }

  requestRefill(dto: { prescriptionId: string; pharmacy?: string; note?: string }): Observable<RefillRequest> {
    return this.http.post<RefillRequest>(`${this.base}/refills`, dto);
  }

  // Billing
  billingSummary(): Observable<BillingSummary> {
    return this.http.get<BillingSummary>(`${this.base}/billing/summary`);
  }

  invoices(): Observable<Invoice[]> {
    return this.http.get<Invoice[]>(`${this.base}/billing/invoices`);
  }

  invoice(id: string): Observable<Invoice> {
    return this.http.get<Invoice>(`${this.base}/billing/invoices/${id}`);
  }

  payments(): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${this.base}/billing/payments`);
  }

  pay(dto: PayInput): Observable<Payment> {
    return this.http.post<Payment>(`${this.base}/billing/payments`, dto);
  }

  cards(): Observable<SavedCard[]> {
    return this.http.get<SavedCard[]>(`${this.base}/billing/cards`);
  }

  addCard(card: CardInput & { makeDefault?: boolean }): Observable<SavedCard> {
    return this.http.post<SavedCard>(`${this.base}/billing/cards`, card);
  }

  setDefaultCard(id: string): Observable<SavedCard[]> {
    return this.http.put<SavedCard[]>(`${this.base}/billing/cards/${id}/default`, {});
  }

  removeCard(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/billing/cards/${id}`);
  }

  // Messages
  threads(): Observable<ThreadSummary[]> {
    return this.http.get<ThreadSummary[]>(`${this.base}/messages`);
  }

  thread(id: string): Observable<Thread> {
    return this.http.get<Thread>(`${this.base}/messages/${id}`);
  }

  startThread(dto: { subject: string; category: ThreadCategory; body: string }): Observable<Thread> {
    return this.http.post<Thread>(`${this.base}/messages`, dto);
  }

  reply(id: string, body: string): Observable<Thread> {
    return this.http.post<Thread>(`${this.base}/messages/${id}/replies`, { body });
  }

  // Profile
  profile(): Observable<EditableProfile> {
    return this.http.get<EditableProfile>(`${this.base}/profile`);
  }

  requestProfileChange(changes: Record<string, unknown>): Observable<ProfileChangeRequest> {
    return this.http.put<ProfileChangeRequest>(`${this.base}/profile`, changes);
  }

  profileRequests(): Observable<ProfileChangeRequest[]> {
    return this.http.get<ProfileChangeRequest[]>(`${this.base}/profile/requests`);
  }

  preferences(): Observable<PreferencesResponse> {
    return this.http.get<PreferencesResponse>(`${this.base}/preferences`);
  }

  savePreferences(preferences: NotificationPreferences): Observable<PreferencesResponse> {
    return this.http.put<PreferencesResponse>(`${this.base}/preferences`, { preferences });
  }
}
