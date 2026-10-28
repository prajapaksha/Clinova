import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  CredentialType,
  DaySchedule,
  ExpiringCredential,
  StaffCredential,
  StaffFilters,
  StaffProfile,
  StaffSummary,
} from '@clinova/staff/domain';

export interface CreateStaffInput {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  title?: string;
  phone?: string;
}

export interface StaffProfileInput {
  title?: string | null;
  suffix?: string | null;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  officeLocation?: string | null;
  npi?: string | null;
  specialties?: string[];
  bio?: string | null;
}

export interface CredentialInput {
  type: CredentialType;
  number: string;
  issuingState?: string | null;
  issuingAuthority?: string | null;
  issueDate?: string | null;
  expirationDate?: string | null;
  isVerified?: boolean;
}

@Injectable({ providedIn: 'root' })
export class StaffApiService {
  private readonly http = inject(HttpClient);

  list(filters: StaffFilters = {}): Observable<StaffSummary[]> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params = params.set(key, value);
    }
    return this.http.get<StaffSummary[]>('/api/staff', { params });
  }

  get(id: string): Observable<StaffProfile> {
    return this.http.get<StaffProfile>(`/api/staff/${id}`);
  }

  create(input: CreateStaffInput): Observable<{ profile: StaffProfile; temporaryPassword: string }> {
    return this.http.post<{ profile: StaffProfile; temporaryPassword: string }>('/api/staff', input);
  }

  updateProfile(id: string, input: StaffProfileInput): Observable<StaffProfile> {
    return this.http.patch<StaffProfile>(`/api/staff/${id}`, input);
  }

  updateAccount(id: string, input: { role?: string; isActive?: boolean }): Observable<StaffProfile> {
    return this.http.patch<StaffProfile>(`/api/staff/${id}/account`, input);
  }

  resetPassword(id: string): Observable<{ temporaryPassword: string }> {
    return this.http.post<{ temporaryPassword: string }>(`/api/staff/${id}/reset-password`, {});
  }

  unlock(id: string): Observable<StaffProfile> {
    return this.http.post<StaffProfile>(`/api/staff/${id}/unlock`, {});
  }

  updateSchedule(id: string, schedule: ReadonlyArray<DaySchedule>): Observable<StaffProfile> {
    return this.http.put<StaffProfile>(`/api/staff/${id}/schedule`, { schedule });
  }

  addCredential(staffId: string, input: CredentialInput): Observable<StaffCredential> {
    return this.http.post<StaffCredential>(`/api/staff/${staffId}/credentials`, input);
  }

  updateCredential(staffId: string, credentialId: string, input: CredentialInput): Observable<StaffCredential> {
    return this.http.put<StaffCredential>(`/api/staff/${staffId}/credentials/${credentialId}`, input);
  }

  removeCredential(staffId: string, credentialId: string): Observable<void> {
    return this.http.delete<void>(`/api/staff/${staffId}/credentials/${credentialId}`);
  }

  expiringCredentials(days = 90): Observable<ExpiringCredential[]> {
    return this.http.get<ExpiringCredential[]>('/api/staff/credentials/expiring', { params: { days } });
  }
}