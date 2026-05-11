import { computed, inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { withEntities, setAllEntities, setEntity, updateEntity } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { pipe, switchMap, tap } from 'rxjs';
import type {
  PortalMessage, PortalMessageId, PortalMessageStatus,
  PatientDemographicsUpdateRequest, AvailableSlot,
} from '@clinova/portal/domain';
import { PortalMessageStatus as MsgStatus } from '@clinova/portal/domain';
import { PortalApiService, type SendMessageDto, type BookSelfSchedulingDto } from './portal.api';

interface PortalState {
  demographicsUpdateRequests: PatientDemographicsUpdateRequest[];
  availableSlots: AvailableSlot[];
  slotsLoading: boolean;
  loading: boolean;
  error: string | null;
}

export const PortalStore = signalStore(
  { providedIn: 'root' },
  withEntities<PortalMessage>(),
  withState<PortalState>({
    demographicsUpdateRequests: [],
    availableSlots: [],
    slotsLoading: false,
    loading: false,
    error: null,
  }),
  withComputed(({ entities }) => ({
    unreadMessages: computed(() =>
      entities().filter(m => m.status === MsgStatus.Unread)
    ),
    unreadCount: computed(() =>
      entities().filter(m => m.status === MsgStatus.Unread).length
    ),
    pendingDemographicsCount: computed(() => 0),
  })),
  withMethods((store, api = inject(PortalApiService)) => ({
    loadMessages: rxMethod<{ patientId?: string; status?: PortalMessageStatus } | void>(pipe(
      tap(() => patchState(store, { loading: true, error: null })),
      switchMap(filters => api.getMessages(filters ?? undefined).pipe(
        tapResponse({
          next: messages => patchState(store, setAllEntities(messages), { loading: false }),
          error: (e: Error) => patchState(store, { error: e.message, loading: false }),
        })
      ))
    )),

    sendMessage: rxMethod<SendMessageDto>(pipe(
      tap(() => patchState(store, { loading: true, error: null })),
      switchMap(dto => api.sendMessage(dto).pipe(
        tapResponse({
          next: msg => patchState(store, setEntity(msg), { loading: false }),
          error: (e: Error) => patchState(store, { error: e.message, loading: false }),
        })
      ))
    )),

    markRead: rxMethod<PortalMessageId>(pipe(
      switchMap(id => api.markRead(id).pipe(
        tapResponse({
          next: () => patchState(store, updateEntity({ id, changes: { status: MsgStatus.Read, readAt: new Date() } })),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    loadAvailableSlots: rxMethod<{ providerId: string; from: Date; to: Date; appointmentTypeId: string }>(pipe(
      tap(() => patchState(store, { slotsLoading: true })),
      switchMap(({ providerId, from, to, appointmentTypeId }) =>
        api.getAvailableSlots(providerId, from, to, appointmentTypeId).pipe(
          tapResponse({
            next: slots => patchState(store, { availableSlots: slots, slotsLoading: false }),
            error: (e: Error) => patchState(store, { error: e.message, slotsLoading: false }),
          })
        )
      )
    )),

    loadDemographicsRequests: rxMethod<string | void>(pipe(
      switchMap(patientId => api.getDemographicsUpdateRequests(patientId ?? undefined).pipe(
        tapResponse({
          next: requests => patchState(store, { demographicsUpdateRequests: requests }),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    clearSlots() {
      patchState(store, { availableSlots: [] });
    },

    clearError() {
      patchState(store, { error: null });
    },
  }))
);
