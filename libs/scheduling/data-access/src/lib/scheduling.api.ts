import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import type {
  Appointment, AppointmentId, AppointmentType, AppointmentTypeId,
  WaitlistEntry, WaitlistEntryId, AppointmentStatus, AppointmentFilters,
  TimeSlot, DateRange, CancellationReason, Provider,
} from '@clinova/scheduling/domain';

export interface BookAppointmentDto {
  patientId: string;
  providerId: string;
  locationId?: string;
  appointmentTypeId: AppointmentTypeId;
  slotStart: string;
  slotEnd: string;
  reasonForVisit?: string;
  notes?: string;
}

export interface UpdateAppointmentDto {
  status?: AppointmentStatus;
  slotStart?: string;
  slotEnd?: string;
  reasonForVisit?: string;
  notes?: string;
  cancellationReason?: CancellationReason;
  cancellationNote?: string;
}

// Maps flat API response (slotStart/slotEnd) to domain shape (slot: TimeSlot)
function mapAppointment(a: Record<string, any>): Appointment {
  const { slotStart, slotEnd, remindersJson, ...rest } = a;
  return {
    ...rest,
    slot: {
      start: new Date(slotStart),
      end: new Date(slotEnd),
    },
    reminders: Array.isArray(a['reminders']) ? a['reminders'] : [],
    createdAt: new Date(a['createdAt']),
    updatedAt: new Date(a['updatedAt']),
    checkedInAt: a['checkedInAt'] ? new Date(a['checkedInAt']) : null,
    completedAt: a['completedAt'] ? new Date(a['completedAt']) : null,
  } as Appointment;
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
    return this.http.get<{ appointments: Record<string, any>[]; total: number }>(
      this.base, { params: toHttpParams(filters) }
    ).pipe(
      map(r => ({ total: r.total, appointments: r.appointments.map(mapAppointment) }))
    );
  }

  findById(id: AppointmentId): Observable<Appointment> {
    return this.http.get<Record<string, any>>(`${this.base}/${id}`).pipe(map(mapAppointment));
  }

  book(dto: BookAppointmentDto): Observable<Appointment> {
    return this.http.post<Record<string, any>>(this.base, dto).pipe(map(mapAppointment));
  }

  update(id: AppointmentId, dto: UpdateAppointmentDto): Observable<Appointment> {
    return this.http.patch<Record<string, any>>(`${this.base}/${id}`, dto).pipe(map(mapAppointment));
  }

  checkIn(id: AppointmentId): Observable<Appointment> {
    return this.http.post<Record<string, any>>(`${this.base}/${id}/check-in`, {}).pipe(map(mapAppointment));
  }

  cancel(id: AppointmentId, reason: CancellationReason, note?: string): Observable<Appointment> {
    return this.http.post<Record<string, any>>(`${this.base}/${id}/cancel`, { reason, note }).pipe(map(mapAppointment));
  }

  markNoShow(id: AppointmentId): Observable<Appointment> {
    return this.http.post<Record<string, any>>(`${this.base}/${id}/no-show`, {}).pipe(map(mapAppointment));
  }

  checkConflicts(providerId: string, slot: TimeSlot, excludeId?: AppointmentId): Observable<Appointment[]> {
    const params: Record<string, string> = {
      providerId,
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
    };
    if (excludeId) params['excludeId'] = excludeId;
    return this.http.get<Record<string, any>[]>(`${this.base}/conflicts`, { params }).pipe(
      map(rows => rows.map(mapAppointment))
    );
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

  getProviders(): Observable<Provider[]> {
    return this.http.get<Provider[]>('/api/staff', { params: { role: 'PHYSICIAN' } });
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
