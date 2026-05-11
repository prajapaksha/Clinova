import { computed, inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { withEntities, setAllEntities, setEntity } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { pipe, switchMap, tap } from 'rxjs';
import type { Encounter, EncounterId, EncounterFilters, EncounterTemplate, TemplateId } from '@clinova/clinical/domain';
import { EncounterStatus } from '@clinova/clinical/domain';
import { ClinicalApiService, type StartEncounterDto, type IssuePrescriptionDto } from './clinical.api';

interface ClinicalState {
  selectedEncounterId: string | null;
  templates: EncounterTemplate[];
  icd10SearchResults: Array<{ code: string; description: string }>;
  drugSearchResults: Array<{ name: string; form: string; strength: string }>;
  loading: boolean;
  saving: boolean;
  error: string | null;
  total: number;
}

export const ClinicalStore = signalStore(
  { providedIn: 'root' },
  withEntities<Encounter>(),
  withState<ClinicalState>({
    selectedEncounterId: null,
    templates: [],
    icd10SearchResults: [],
    drugSearchResults: [],
    loading: false,
    saving: false,
    error: null,
    total: 0,
  }),
  withComputed(({ entities, selectedEncounterId }) => ({
    selectedEncounter: computed(() => entities().find(e => e.id === selectedEncounterId()) ?? null),

    unsignedEncounters: computed(() =>
      entities().filter(e => e.status === EncounterStatus.Draft || e.status === EncounterStatus.InProgress)
    ),

    selectedIsEditable: computed(() => {
      const enc = entities().find(e => e.id === selectedEncounterId());
      return enc?.status === EncounterStatus.Draft || enc?.status === EncounterStatus.InProgress;
    }),
  })),
  withMethods((store, api = inject(ClinicalApiService)) => ({
    loadEncounters: rxMethod<EncounterFilters>(pipe(
      tap(() => patchState(store, { loading: true, error: null })),
      switchMap(filters => api.getEncounters(filters).pipe(
        tapResponse({
          next: result => patchState(store, setAllEntities(result.encounters), { total: result.total, loading: false }),
          error: (e: Error) => patchState(store, { error: e.message, loading: false }),
        })
      ))
    )),

    loadById: rxMethod<EncounterId>(pipe(
      switchMap(id => api.findById(id).pipe(
        tapResponse({
          next: enc => patchState(store, setEntity(enc)),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    loadTemplates: rxMethod<{ specialty?: string } | void>(pipe(
      switchMap(filters => api.getTemplates(filters ?? undefined).pipe(
        tapResponse({
          next: templates => patchState(store, { templates }),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    startEncounter: rxMethod<StartEncounterDto>(pipe(
      tap(() => patchState(store, { loading: true, error: null })),
      switchMap(dto => api.start(dto).pipe(
        tapResponse({
          next: enc => patchState(store, setEntity(enc), { loading: false, selectedEncounterId: enc.id }),
          error: (e: Error) => patchState(store, { error: e.message, loading: false }),
        })
      ))
    )),

    sign: rxMethod<EncounterId>(pipe(
      tap(() => patchState(store, { saving: true, error: null })),
      switchMap(id => api.sign(id).pipe(
        tapResponse({
          next: enc => patchState(store, setEntity(enc), { saving: false }),
          error: (e: Error) => patchState(store, { error: e.message, saving: false }),
        })
      ))
    )),

    issuePrescription: rxMethod<{ encounterId: EncounterId; dto: IssuePrescriptionDto }>(pipe(
      switchMap(({ encounterId, dto }) => api.issuePrescription(encounterId, dto).pipe(
        tapResponse({
          next: () => { /* reload encounter to reflect new prescription */ },
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    searchIcd10: rxMethod<string>(pipe(
      switchMap(query => api.searchIcd10(query).pipe(
        tapResponse({
          next: results => patchState(store, { icd10SearchResults: results }),
          error: () => patchState(store, { icd10SearchResults: [] }),
        })
      ))
    )),

    searchDrugs: rxMethod<string>(pipe(
      switchMap(query => api.searchDrugs(query).pipe(
        tapResponse({
          next: results => patchState(store, { drugSearchResults: results }),
          error: () => patchState(store, { drugSearchResults: [] }),
        })
      ))
    )),

    selectEncounter(id: string) {
      patchState(store, { selectedEncounterId: id });
    },

    clearIcd10Results() {
      patchState(store, { icd10SearchResults: [] });
    },

    clearDrugResults() {
      patchState(store, { drugSearchResults: [] });
    },

    clearError() {
      patchState(store, { error: null });
    },
  }))
);
