import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  Appointment, AppointmentId, AppointmentType, AppointmentTypeId,
  WaitlistEntry, WaitlistEntryId, AppointmentStatus, AppointmentFilters,
  TimeSlot, DateRange, CancellationReason,
} from '@clinova/scheduling/domain';

export interface BookAppointmentDto {
  patientId: string;
  providerId: string;
  locationId: string;
  appointmentTypeId: AppointmentTypeId;
  slot: { start: string; end: string };
  reasonForVisit?: string;
  notes?: string;
}

export interface UpdateAppointmentDto {
  status?: AppointmentStatus;
  slot?: { start: string; end: string };
  reasonForVisit?: string;
  notes?: string;
  cancellationReason?: CancellationReason;
  cancellationNote?: string;
}

function toHttpParams(filters: AppointmentFilters): HttpParams {
  let p = new HttpParams();
  if (filters.providerId) p = p.set('providerId', filters.providerId);
  if (filters.patientId) p = p.set('patientId', filters.patientId);
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
export class SchedulingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/appointments';

  getAppointments(filters: AppointmentFilters = {}): Observable<{ appointments: Appointment[]; total: number }> {
    return this.http.get<{ appointments: Appointment[]; total: number }>(this.base, { params: toHttpParams(filters) });
  }

  findById(id: AppointmentId): Observable<Appointment> {
    return this.http.get<Appointment>(`${this.base}/${id}`);
  }

  book(dto: BookAppointmentDto): Observable<Appointment> {
    return this.http.post<Appointment>(this.base, dto);
  }

  update(id: AppointmentId, dto: UpdateAppointmentDto): Observable<Appointment> {
    return this.http.patch<Appointment>(`${this.base}/${id}`, dto);
  }

  checkIn(id: AppointmentId): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.base}/${id}/check-in`, {});
  }

  cancel(id: AppointmentId, reason: CancellationReason, note?: string): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.base}/${id}/cancel`, { reason, note });
  }

  markNoShow(id: AppointmentId): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.base}/${id}/no-show`, {});
  }

  checkConflicts(providerId: string, slot: TimeSlot, excludeId?: AppointmentId): Observable<Appointment[]> {
    const params: Record<string, string> = {
      providerId,
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
    };
    if (excludeId) params['excludeId'] = excludeId;
    return this.http.get<Appointment[]>(`${this.base}/conflicts`, { params });
  }

  getAvailableSlots(providerId: string, dateRange: DateRange, durationMinutes: number): Observable<TimeSlot[]> {
    return this.http.get<TimeSlot[]>('/api/slots/available', {
      params: {
        providerId,
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
        duration: String(durationMinutes),
      },
    });
  }

  getAppointmentTypes(activeOnly = true): Observable<AppointmentType[]> {
    return this.http.get<AppointmentType[]>('/api/appointment-types', { params: { activeOnly: String(activeOnly) } });
  }

  getWaitlist(): Observable<WaitlistEntry[]> {
    return this.http.get<WaitlistEntry[]>('/api/waitlist');
  }

  addToWaitlist(entry: Omit<WaitlistEntry, 'id' | 'addedAt' | 'fulfilledAt' | 'fulfilledAppointmentId'>): Observable<WaitlistEntry> {
    return this.http.post<WaitlistEntry>('/api/waitlist', entry);
  }

  removeFromWaitlist(id: WaitlistEntryId): Observable<void> {
    return this.http.delete<void>(`/api/waitlist/${id}`);
  }
}
