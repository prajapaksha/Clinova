import { computed, inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { withEntities, setAllEntities, setEntity } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { pipe, switchMap, tap } from 'rxjs';
import type { Patient, PatientId, MRN, PatientSearchFilters } from '@clinova/patient/domain';
import { AlertSeverity } from '@clinova/patient/domain';
import { PatientApiService, type CreatePatientDto, type UpdatePatientDto } from './patient.api';

interface PatientState {
  selectedId: string | null;
  loading: boolean;
  error: string | null;
  total: number;
  searchQuery: string;
}

export const PatientStore = signalStore(
  { providedIn: 'root' },
  withEntities<Patient>(),
  withState<PatientState>({
    selectedId: null,
    loading: false,
    error: null,
    total: 0,
    searchQuery: '',
  }),
  withComputed(({ entities, selectedId }) => ({
    selectedPatient: computed(() => entities().find(p => p.id === selectedId()) ?? null),

    selectedHasCriticalAllergy: computed(() => {
      const patient = entities().find(p => p.id === selectedId());
      return patient?.allergies.some(a => a.severity === AlertSeverity.Critical) ?? false;
    }),

    selectedActiveAlerts: computed(() => {
      const patient = entities().find(p => p.id === selectedId());
      return patient?.alerts.filter(a => a.isActive) ?? [];
    }),
  })),
  withMethods((store, api = inject(PatientApiService)) => ({
    search: rxMethod<PatientSearchFilters>(pipe(
      tap(() => patchState(store, { loading: true, error: null })),
      switchMap(filters => api.search(filters).pipe(
        tapResponse({
          next: result => patchState(store, setAllEntities(result.patients), { total: result.total, loading: false }),
          error: (e: Error) => patchState(store, { error: e.message, loading: false }),
        })
      ))
    )),

    loadById: rxMethod<PatientId>(pipe(
      switchMap(id => api.findById(id).pipe(
        tapResponse({
          next: patient => patchState(store, setEntity(patient)),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    loadByMrn: rxMethod<MRN>(pipe(
      switchMap(mrn => api.findByMrn(mrn).pipe(
        tapResponse({
          next: patient => patchState(store, setEntity(patient)),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    createPatient: rxMethod<CreatePatientDto>(pipe(
      tap(() => patchState(store, { loading: true, error: null })),
      switchMap(dto => api.create(dto).pipe(
        tapResponse({
          next: patient => patchState(store, setEntity(patient), { loading: false, selectedId: patient.id }),
          error: (e: Error) => patchState(store, { error: e.message, loading: false }),
        })
      ))
    )),

    updatePatient: rxMethod<{ id: PatientId; dto: UpdatePatientDto }>(pipe(
      switchMap(({ id, dto }) => api.update(id, dto).pipe(
        tapResponse({
          next: patient => patchState(store, setEntity(patient)),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    selectPatient(id: string) {
      patchState(store, { selectedId: id });
    },

    clearSelection() {
      patchState(store, { selectedId: null });
    },

    setSearchQuery(query: string) {
      patchState(store, { searchQuery: query });
    },

    clearError() {
      patchState(store, { error: null });
    },
  }))
);
