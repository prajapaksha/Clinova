import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  StaffMember, StaffId, Provider, ProviderId,
  Credential, CredentialId, TimeOffRequest, TimeOffId, TimeOffStatus,
  DaySchedule, StaffFilters,
} from '@clinova/staff/domain';

export interface CreateStaffDto {
  userId: string;
  firstName: string;
  lastName: string;
  displayName: string;
  workEmail: string;
  title?: string;
  directPhone?: string;
  locationId?: string;
}

export interface UpdateStaffDto {
  title?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  directPhone?: string;
  locationId?: string;
  weeklySchedule?: DaySchedule[];
}

export interface CreateProviderDto extends CreateStaffDto {
  npi: string;
  specialties: string[];
  defaultAppointmentDurationMinutes: number;
  bufferBetweenAppointmentsMinutes: number;
}

@Injectable({ providedIn: 'root' })
export class StaffApiService {
  private readonly http = inject(HttpClient);

  getStaff(filters: StaffFilters = {}): Observable<StaffMember[]> {
    const params: Record<string, string> = {};
    if (filters.isActive != null) params['isActive'] = String(filters.isActive);
    if (filters.locationId) params['locationId'] = filters.locationId;
    return this.http.get<StaffMember[]>('/api/staff', { params });
  }

  getStaffById(id: StaffId): Observable<StaffMember> {
    return this.http.get<StaffMember>(`/api/staff/${id}`);
  }

  createStaff(dto: CreateStaffDto): Observable<StaffMember> {
    return this.http.post<StaffMember>('/api/staff', dto);
  }

  updateStaff(id: StaffId, dto: UpdateStaffDto): Observable<StaffMember> {
    return this.http.patch<StaffMember>(`/api/staff/${id}`, dto);
  }

  deactivateStaff(id: StaffId): Observable<void> {
    return this.http.delete<void>(`/api/staff/${id}`);
  }

  getProviders(filters: StaffFilters & { specialty?: string } = {}): Observable<Provider[]> {
    const params: Record<string, string> = {};
    if (filters.isActive != null) params['isActive'] = String(filters.isActive);
    if (filters.specialty) params['specialty'] = filters.specialty;
    return this.http.get<Provider[]>('/api/providers', { params });
  }

  getProviderById(id: ProviderId): Observable<Provider> {
    return this.http.get<Provider>(`/api/providers/${id}`);
  }

  createProvider(dto: CreateProviderDto): Observable<Provider> {
    return this.http.post<Provider>('/api/providers', dto);
  }

  updateProvider(id: ProviderId, dto: Partial<CreateProviderDto>): Observable<Provider> {
    return this.http.patch<Provider>(`/api/providers/${id}`, dto);
  }

  addCredential(staffId: StaffId, credential: Omit<Credential, 'id'>): Observable<Credential> {
    return this.http.post<Credential>(`/api/staff/${staffId}/credentials`, credential);
  }

  updateCredential(staffId: StaffId, credentialId: CredentialId, updates: Partial<Omit<Credential, 'id'>>): Observable<Credential> {
    return this.http.patch<Credential>(`/api/staff/${staffId}/credentials/${credentialId}`, updates);
  }

  getTimeOffRequests(staffId?: StaffId): Observable<TimeOffRequest[]> {
    const params: Record<string, string> = {};
    if (staffId) params['staffId'] = staffId;
    return this.http.get<TimeOffRequest[]>('/api/time-off', { params });
  }

  requestTimeOff(request: Omit<TimeOffRequest, 'id' | 'status' | 'reviewedBy' | 'reviewedAt' | 'createdAt'>): Observable<TimeOffRequest> {
    return this.http.post<TimeOffRequest>('/api/time-off', request);
  }

  reviewTimeOff(id: TimeOffId, status: TimeOffStatus.Approved | TimeOffStatus.Denied): Observable<TimeOffRequest> {
    return this.http.patch<TimeOffRequest>(`/api/time-off/${id}`, { status });
  }
}
