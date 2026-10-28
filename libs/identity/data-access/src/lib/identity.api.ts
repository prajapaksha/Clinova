import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { AuditLogEntry, AuditLogFilters } from '@clinova/identity/domain';

export interface AuditLogPage {
  entries: AuditLogEntry[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class IdentityApiService {
  private readonly http = inject(HttpClient);

  auditLogs(filters: AuditLogFilters = {}): Observable<AuditLogPage> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === '') continue;
      for (const v of Array.isArray(value) ? value : [value]) params = params.append(key, String(v));
    }
    return this.http.get<AuditLogPage>('/api/audit-logs', { params });
  }
}