import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  NotificationTemplate, NotificationTemplateId,
  NotificationLog, NotificationPreferences,
  NotificationChannel, NotificationTrigger,
} from '@clinova/notifications/domain';

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly http = inject(HttpClient);

  getTemplates(activeOnly = true): Observable<NotificationTemplate[]> {
    return this.http.get<NotificationTemplate[]>('/api/notification-templates', { params: { activeOnly: String(activeOnly) } });
  }

  getTemplate(id: NotificationTemplateId): Observable<NotificationTemplate> {
    return this.http.get<NotificationTemplate>(`/api/notification-templates/${id}`);
  }

  updateTemplate(id: NotificationTemplateId, updates: { subjectTemplate?: string; bodyTemplate?: string; isActive?: boolean }): Observable<NotificationTemplate> {
    return this.http.patch<NotificationTemplate>(`/api/notification-templates/${id}`, updates);
  }

  getLog(filters: { entityType?: string; entityId?: string; recipientId?: string; limit?: number }): Observable<NotificationLog[]> {
    const params: Record<string, string> = {};
    if (filters.entityType) params['entityType'] = filters.entityType;
    if (filters.entityId) params['entityId'] = filters.entityId;
    if (filters.recipientId) params['recipientId'] = filters.recipientId;
    if (filters.limit) params['limit'] = String(filters.limit);
    return this.http.get<NotificationLog[]>('/api/notification-log', { params });
  }

  getPatientPreferences(patientId: string): Observable<NotificationPreferences> {
    return this.http.get<NotificationPreferences>(`/api/patients/${patientId}/notification-preferences`);
  }

  updatePatientPreferences(patientId: string, prefs: Partial<NotificationPreferences>): Observable<NotificationPreferences> {
    return this.http.patch<NotificationPreferences>(`/api/patients/${patientId}/notification-preferences`, prefs);
  }

  sendTest(trigger: NotificationTrigger, channel: NotificationChannel, recipientId: string): Observable<void> {
    return this.http.post<void>('/api/notification-templates/test', { trigger, channel, recipientId });
  }
}
