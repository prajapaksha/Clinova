import { computed, inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { withEntities, setAllEntities, setEntity, updateEntity } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { pipe, switchMap, tap } from 'rxjs';
import type {
  Appointment, AppointmentId, AppointmentType, AppointmentFilters,
  WaitlistEntry, CancellationReason, TimeSlot, Provider,
} from '@clinova/scheduling/domain';
import { AppointmentStatus } from '@clinova/scheduling/domain';
import { SchedulingApiService, type BookAppointmentDto } from './scheduling.api';

type CalendarView = 'day' | 'week' | 'month' | 'agenda' | 'resource';

interface SchedulingState {
  selectedAppointmentId: string | null;
  viewDate: Date;
  view: CalendarView;
  appointmentTypes: AppointmentType[];
  providers: Provider[];
  waitlist: WaitlistEntry[];
  loading: boolean;
  error: string | null;
  total: number;
}

export const SchedulingStore = signalStore(
  { providedIn: 'root' },
  withEntities<Appointment>(),
  withState<SchedulingState>({
    selectedAppointmentId: null,
    viewDate: new Date(),
    view: 'week',
    appointmentTypes: [],
    providers: [],
    waitlist: [],
    loading: false,
    error: null,
    total: 0,
  }),
  withComputed(({ entities, selectedAppointmentId, viewDate }) => ({
    selectedAppointment: computed(() => entities().find(a => a.id === selectedAppointmentId()) ?? null),

    todaysAppointments: computed(() => {
      const today = viewDate();
      return entities().filter(a => {
        const d = new Date(a.slot.start);
        return d.getFullYear() === today.getFullYear()
          && d.getMonth() === today.getMonth()
          && d.getDate() === today.getDate();
      });
    }),

    checkedInAppointments: computed(() =>
      entities().filter(a => a.status === AppointmentStatus.CheckedIn)
    ),

    waitingRoomCount: computed(() =>
      entities().filter(a =>
        a.status === AppointmentStatus.CheckedIn || a.status === AppointmentStatus.InProgress
      ).length
    ),
  })),
  withMethods((store, api = inject(SchedulingApiService)) => ({
    loadAppointments: rxMethod<AppointmentFilters>(pipe(
      tap(() => patchState(store, { loading: true, error: null })),
      switchMap(filters => api.getAppointments(filters).pipe(
        tapResponse({
          next: result => patchState(store, setAllEntities(result.appointments), { total: result.total, loading: false }),
          error: (e: Error) => patchState(store, { error: e.message, loading: false }),
        })
      ))
    )),

    loadAppointmentTypes: rxMethod<void>(pipe(
      switchMap(() => api.getAppointmentTypes().pipe(
        tapResponse({
          next: types => patchState(store, { appointmentTypes: types }),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    loadProviders: rxMethod<void>(pipe(
      switchMap(() => api.getProviders().pipe(
        tapResponse({
          next: providers => patchState(store, { providers }),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    loadWaitlist: rxMethod<void>(pipe(
      switchMap(() => api.getWaitlist().pipe(
        tapResponse({
          next: waitlist => patchState(store, { waitlist }),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    book: rxMethod<BookAppointmentDto>(pipe(
      tap(() => patchState(store, { loading: true, error: null })),
      switchMap(dto => api.book(dto).pipe(
        tapResponse({
          next: appt => patchState(store, setEntity(appt), { loading: false, selectedAppointmentId: appt.id }),
          error: (e: Error) => patchState(store, { error: e.message, loading: false }),
        })
      ))
    )),

    checkIn: rxMethod<AppointmentId>(pipe(
      switchMap(id => api.checkIn(id).pipe(
        tapResponse({
          next: appt => patchState(store, setEntity(appt)),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    cancel: rxMethod<{ id: AppointmentId; reason: CancellationReason; note?: string }>(pipe(
      switchMap(({ id, reason, note }) => api.cancel(id, reason, note).pipe(
        tapResponse({
          next: appt => patchState(store, setEntity(appt)),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    markNoShow: rxMethod<AppointmentId>(pipe(
      switchMap(id => api.markNoShow(id).pipe(
        tapResponse({
          next: appt => patchState(store, setEntity(appt)),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    selectAppointment(id: string) {
      patchState(store, { selectedAppointmentId: id });
    },

    clearSelection() {
      patchState(store, { selectedAppointmentId: null });
    },

    setView(view: CalendarView) {
      patchState(store, { view });
    },

    setViewDate(date: Date) {
      patchState(store, { viewDate: date });
    },

    clearError() {
      patchState(store, { error: null });
    },
  }))
);
