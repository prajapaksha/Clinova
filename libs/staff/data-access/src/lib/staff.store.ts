import { computed, inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { withEntities, setAllEntities, setEntity, entityConfig } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { pipe, switchMap, tap } from 'rxjs';
import type { StaffMember, StaffId, Provider, ProviderId, TimeOffRequest, StaffFilters } from '@clinova/staff/domain';
import { StaffApiService } from './staff.api';

const providerConfig = entityConfig({
  entity: {} as Provider,
  collection: 'providers',
  selectId: (p: Provider) => p.providerId,
});

interface StaffState {
  selectedStaffId: string | null;
  selectedProviderId: string | null;
  timeOffRequests: TimeOffRequest[];
  loading: boolean;
  error: string | null;
}

export const StaffStore = signalStore(
  { providedIn: 'root' },
  withEntities<StaffMember>(),
  withEntities(providerConfig),
  withState<StaffState>({
    selectedStaffId: null,
    selectedProviderId: null,
    timeOffRequests: [],
    loading: false,
    error: null,
  }),
  withComputed(({ entities, selectedStaffId, providersEntities, selectedProviderId }) => ({
    selectedStaff: computed(() => entities().find(s => s.id === selectedStaffId()) ?? null),
    selectedProvider: computed(() => providersEntities().find(p => p.providerId === selectedProviderId()) ?? null),
    activeProviders: computed(() => providersEntities().filter(p => p.isActive)),
    activeStaff: computed(() => entities().filter(s => s.isActive)),
  })),
  withMethods((store, api = inject(StaffApiService)) => ({
    loadStaff: rxMethod<StaffFilters | void>(pipe(
      tap(() => patchState(store, { loading: true, error: null })),
      switchMap(filters => api.getStaff(filters ?? undefined).pipe(
        tapResponse({
          next: staff => patchState(store, setAllEntities(staff), { loading: false }),
          error: (e: Error) => patchState(store, { error: e.message, loading: false }),
        })
      ))
    )),

    loadProviders: rxMethod<(StaffFilters & { specialty?: string }) | void>(pipe(
      tap(() => patchState(store, { loading: true, error: null })),
      switchMap(filters => api.getProviders(filters ?? undefined).pipe(
        tapResponse({
          next: providers => patchState(store, setAllEntities(providers, providerConfig), { loading: false }),
          error: (e: Error) => patchState(store, { error: e.message, loading: false }),
        })
      ))
    )),

    loadTimeOff: rxMethod<StaffId | void>(pipe(
      switchMap(staffId => api.getTimeOffRequests(staffId ?? undefined).pipe(
        tapResponse({
          next: requests => patchState(store, { timeOffRequests: requests }),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    loadProviderById: rxMethod<ProviderId>(pipe(
      switchMap(id => api.getProviderById(id).pipe(
        tapResponse({
          next: provider => patchState(store, setEntity(provider, providerConfig)),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    selectStaff(id: string) {
      patchState(store, { selectedStaffId: id });
    },

    selectProvider(id: string) {
      patchState(store, { selectedProviderId: id });
    },

    clearError() {
      patchState(store, { error: null });
    },
  }))
);
