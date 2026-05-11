import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  PortalMessage, PortalMessageId, PortalMessageStatus,
  PatientDemographicsUpdateRequest, AvailableSlot,
} from '@clinova/portal/domain';

export interface SendMessageDto {
  patientId: string;
  subject?: string;
  body: string;
  threadId?: string;
}

export interface BookSelfSchedulingDto {
  patientId: string;
  providerId: string;
  appointmentTypeId: string;
  start: string;
  end: string;
  reasonForVisit?: string;
}

@Injectable({ providedIn: 'root' })
export class PortalApiService {
  private readonly http = inject(HttpClient);

  getMessages(filters?: { patientId?: string; status?: PortalMessageStatus }): Observable<PortalMessage[]> {
    const params: Record<string, string> = {};
    if (filters?.patientId) params['patientId'] = filters.patientId;
    if (filters?.status) params['status'] = filters.status;
    return this.http.get<PortalMessage[]>('/api/portal/messages', { params });
  }

  sendMessage(dto: SendMessageDto): Observable<PortalMessage> {
    return this.http.post<PortalMessage>('/api/portal/messages', dto);
  }

  markRead(id: PortalMessageId): Observable<void> {
    return this.http.post<void>(`/api/portal/messages/${id}/read`, {});
  }

  archiveMessage(id: PortalMessageId): Observable<void> {
    return this.http.delete<void>(`/api/portal/messages/${id}`);
  }

  getAvailableSlots(providerId: string, from: Date, to: Date, appointmentTypeId: string): Observable<AvailableSlot[]> {
    return this.http.get<AvailableSlot[]>('/api/portal/slots', {
      params: { providerId, from: from.toISOString(), to: to.toISOString(), appointmentTypeId },
    });
  }

  bookAppointment(dto: BookSelfSchedulingDto): Observable<{ appointmentId: string }> {
    return this.http.post<{ appointmentId: string }>('/api/portal/appointments', dto);
  }

  cancelAppointment(appointmentId: string, reason: string): Observable<void> {
    return this.http.post<void>(`/api/portal/appointments/${appointmentId}/cancel`, { reason });
  }

  getDemographicsUpdateRequests(patientId?: string): Observable<PatientDemographicsUpdateRequest[]> {
    const params: Record<string, string> = {};
    if (patientId) params['patientId'] = patientId;
    return this.http.get<PatientDemographicsUpdateRequest[]>('/api/portal/demographics-updates', { params });
  }

  requestDemographicsUpdate(patientId: string, changes: Record<string, unknown>): Observable<PatientDemographicsUpdateRequest> {
    return this.http.post<PatientDemographicsUpdateRequest>('/api/portal/demographics-updates', { patientId, changes });
  }

  reviewDemographicsUpdate(id: string, approved: boolean, rejectionReason?: string): Observable<PatientDemographicsUpdateRequest> {
    return this.http.patch<PatientDemographicsUpdateRequest>(`/api/portal/demographics-updates/${id}`, { approved, rejectionReason });
  }
}
