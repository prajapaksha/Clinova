import { inject } from '@angular/core';
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { pipe, switchMap } from 'rxjs';
import type { NotificationTemplate, NotificationLog, NotificationPreferences, NotificationChannel, NotificationTrigger, NotificationTemplateId } from '@clinova/notifications/domain';
import { NotificationsApiService } from './notifications.api';

interface NotificationsState {
  templates: NotificationTemplate[];
  log: NotificationLog[];
  preferences: Record<string, NotificationPreferences>;
  loading: boolean;
  error: string | null;
}

export const NotificationsStore = signalStore(
  { providedIn: 'root' },
  withState<NotificationsState>({
    templates: [],
    log: [],
    preferences: {},
    loading: false,
    error: null,
  }),
  withMethods((store, api = inject(NotificationsApiService)) => ({
    loadTemplates: rxMethod<void>(pipe(
      switchMap(() => api.getTemplates().pipe(
        tapResponse({
          next: templates => patchState(store, { templates }),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    loadLog: rxMethod<{ entityType?: string; entityId?: string; recipientId?: string }>(pipe(
      switchMap(filters => api.getLog(filters).pipe(
        tapResponse({
          next: log => patchState(store, { log }),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    loadPatientPreferences: rxMethod<string>(pipe(
      switchMap(patientId => api.getPatientPreferences(patientId).pipe(
        tapResponse({
          next: prefs => patchState(store, state => ({
            preferences: { ...state.preferences, [patientId]: prefs },
          })),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    updateTemplate: rxMethod<{ id: NotificationTemplateId; updates: { subjectTemplate?: string; bodyTemplate?: string; isActive?: boolean } }>(pipe(
      switchMap(({ id, updates }) => api.updateTemplate(id, updates).pipe(
        tapResponse({
          next: updated => patchState(store, state => ({
            templates: state.templates.map(t => t.id === id ? updated : t),
          })),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    updatePatientPreferences: rxMethod<{ patientId: string; prefs: Partial<NotificationPreferences> }>(pipe(
      switchMap(({ patientId, prefs }) => api.updatePatientPreferences(patientId, prefs).pipe(
        tapResponse({
          next: updated => patchState(store, state => ({
            preferences: { ...state.preferences, [patientId]: updated },
          })),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    clearError() {
      patchState(store, { error: null });
    },
  }))
);
