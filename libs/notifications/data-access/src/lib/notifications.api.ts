import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { NotificationChannel, NotificationLogEntry, NotificationType, StaffNotificationItem, TemplateView } from '@clinova/notifications/domain';

export interface LogFilters {
  patientId?: string;
  appointmentId?: string;
  status?: string;
  channel?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export interface TemplatePreview {
  subject: string | null;
  body: string;
  errors: string[];
}

/** Staff-side notification APIs: delivery log, templates and the in-app notification center. */
@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly http = inject(HttpClient);

  log(filters: LogFilters = {}): Observable<{ entries: NotificationLogEntry[]; total: number }> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filters)) if (v !== undefined && v !== '') params = params.set(k, String(v));
    return this.http.get<{ entries: NotificationLogEntry[]; total: number }>('/api/notifications', { params });
  }

  summary(): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>('/api/notifications/summary');
  }

  retry(id: string): Observable<NotificationLogEntry> {
    return this.http.post<NotificationLogEntry>(`/api/notifications/${id}/retry`, {});
  }

  cancel(id: string): Observable<NotificationLogEntry> {
    return this.http.post<NotificationLogEntry>(`/api/notifications/${id}/cancel`, {});
  }

  templates(): Observable<TemplateView[]> {
    return this.http.get<TemplateView[]>('/api/notification-templates');
  }

  saveTemplate(type: NotificationType, channel: NotificationChannel, input: { subject: string | null; body: string; isActive: boolean }): Observable<TemplateView> {
    return this.http.put<TemplateView>(`/api/notification-templates/${type}/${channel}`, input);
  }

  resetTemplate(type: NotificationType, channel: NotificationChannel): Observable<TemplateView> {
    return this.http.delete<TemplateView>(`/api/notification-templates/${type}/${channel}`);
  }

  preview(type: NotificationType, subject: string | null, body: string): Observable<TemplatePreview> {
    return this.http.post<TemplatePreview>('/api/notification-templates/preview', { type, subject, body });
  }

  mine(): Observable<{ items: StaffNotificationItem[]; unread: number }> {
    return this.http.get<{ items: StaffNotificationItem[]; unread: number }>('/api/me/notifications');
  }

  markRead(id?: string): Observable<void> {
    return this.http.post<void>('/api/me/notifications/read', id ? { id } : {});
  }
}