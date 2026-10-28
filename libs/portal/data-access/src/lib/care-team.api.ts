import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { PortalAccessSummary, ProfileChangeRequest, RefillRequest, Thread, ThreadSummary } from '@clinova/portal/domain';

export interface InboxSummary {
  unreadThreads: number;
  pendingRefills: number;
  pendingChanges: number;
}

/** Staff-side portal operations: invites, the care-team inbox and request review. */
@Injectable({ providedIn: 'root' })
export class CareTeamApiService {
  private readonly http = inject(HttpClient);

  portalAccess(patientId: string): Observable<PortalAccessSummary> {
    return this.http.get<PortalAccessSummary>(`/api/patients/${patientId}/portal-access`);
  }

  invite(patientId: string, email?: string): Observable<{ code: string; email: string; expiresAt: string }> {
    return this.http.post<{ code: string; email: string; expiresAt: string }>(`/api/patients/${patientId}/portal-access/invite`, email ? { email } : {});
  }

  setPortalDisabled(patientId: string, disabled: boolean): Observable<PortalAccessSummary> {
    return this.http.put<PortalAccessSummary>(`/api/patients/${patientId}/portal-access/status`, { disabled });
  }

  summary(): Observable<InboxSummary> {
    return this.http.get<InboxSummary>('/api/inbox/summary');
  }

  threads(filters: { status?: string; category?: string; patientId?: string; unread?: boolean } = {}): Observable<ThreadSummary[]> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== '' && v !== false) params = params.set(k, String(v));
    return this.http.get<ThreadSummary[]>('/api/inbox/threads', { params });
  }

  thread(id: string): Observable<Thread> {
    return this.http.get<Thread>(`/api/inbox/threads/${id}`);
  }

  reply(id: string, body: string): Observable<Thread> {
    return this.http.post<Thread>(`/api/inbox/threads/${id}/messages`, { body });
  }

  setThreadStatus(id: string, status: 'OPEN' | 'CLOSED'): Observable<ThreadSummary> {
    return this.http.patch<ThreadSummary>(`/api/inbox/threads/${id}`, { status });
  }

  refills(status = 'PENDING'): Observable<RefillRequest[]> {
    return this.http.get<RefillRequest[]>('/api/refill-requests', { params: { status } });
  }

  respondRefill(id: string, decision: 'APPROVED' | 'DENIED', note?: string): Observable<RefillRequest> {
    return this.http.post<RefillRequest>(`/api/refill-requests/${id}/response`, { decision, note });
  }

  changeRequests(status = 'PENDING'): Observable<ProfileChangeRequest[]> {
    return this.http.get<ProfileChangeRequest[]>('/api/profile-change-requests', { params: { status } });
  }

  reviewChange(id: string, decision: 'APPROVED' | 'REJECTED', reason?: string): Observable<ProfileChangeRequest> {
    return this.http.post<ProfileChangeRequest>(`/api/profile-change-requests/${id}/review`, { decision, reason });
  }
}
