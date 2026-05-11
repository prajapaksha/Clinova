import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { User, UserId, UserRole, AuditLogEntry } from '@clinova/identity/domain';

export interface CreateUserDto {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  mfaEnabled: boolean;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  isActive?: boolean;
  mfaEnabled?: boolean;
}

@Injectable({ providedIn: 'root' })
export class IdentityApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/users';

  findAll(filters?: { role?: UserRole; isActive?: boolean }): Observable<User[]> {
    const params: Record<string, string> = {};
    if (filters?.role) params['role'] = filters.role;
    if (filters?.isActive != null) params['isActive'] = String(filters.isActive);
    return this.http.get<User[]>(this.base, { params });
  }

  findById(id: UserId): Observable<User> {
    return this.http.get<User>(`${this.base}/${id}`);
  }

  findMe(): Observable<User> {
    return this.http.get<User>(`${this.base}/me`);
  }

  create(dto: CreateUserDto): Observable<User> {
    return this.http.post<User>(this.base, dto);
  }

  update(id: UserId, dto: UpdateUserDto): Observable<User> {
    return this.http.patch<User>(`${this.base}/${id}`, dto);
  }

  deactivate(id: UserId): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  getAuditLog(filters: { patientId?: string; userId?: string; limit?: number }): Observable<AuditLogEntry[]> {
    const params: Record<string, string> = {};
    if (filters.patientId) params['patientId'] = filters.patientId;
    if (filters.userId) params['userId'] = filters.userId;
    if (filters.limit) params['limit'] = String(filters.limit);
    return this.http.get<AuditLogEntry[]>('/api/audit-log', { params });
  }
}
