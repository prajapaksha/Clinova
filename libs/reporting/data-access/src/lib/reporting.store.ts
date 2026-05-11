import { inject } from '@angular/core';
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { pipe, switchMap, tap } from 'rxjs';
import type {
  KpiSummary, DailyScheduleReport, RevenueReport, ArAgingReport,
  AppointmentAnalyticsReport, ProviderProductivityReport, OutstandingTasksReport,
  ReportFilter,
} from '@clinova/reporting/domain';
import { ReportingApiService } from './reporting.api';

interface ReportingState {
  kpi: KpiSummary | null;
  dailySchedule: DailyScheduleReport[];
  revenue: RevenueReport[];
  arAging: ArAgingReport | null;
  appointmentAnalytics: AppointmentAnalyticsReport[];
  providerProductivity: ProviderProductivityReport[];
  outstandingTasks: OutstandingTasksReport | null;
  activeFilter: ReportFilter | null;
  loading: boolean;
  error: string | null;
}

export const ReportingStore = signalStore(
  { providedIn: 'root' },
  withState<ReportingState>({
    kpi: null,
    dailySchedule: [],
    revenue: [],
    arAging: null,
    appointmentAnalytics: [],
    providerProductivity: [],
    outstandingTasks: null,
    activeFilter: null,
    loading: false,
    error: null,
  }),
  withMethods((store, api = inject(ReportingApiService)) => ({
    loadKpi: rxMethod<void>(pipe(
      tap(() => patchState(store, { loading: true })),
      switchMap(() => api.getKpiSummary().pipe(
        tapResponse({
          next: kpi => patchState(store, { kpi, loading: false }),
          error: (e: Error) => patchState(store, { error: e.message, loading: false }),
        })
      ))
    )),

    loadDailySchedule: rxMethod<ReportFilter>(pipe(
      tap(filter => patchState(store, { loading: true, activeFilter: filter })),
      switchMap(filter => api.getDailySchedule(filter).pipe(
        tapResponse({
          next: data => patchState(store, { dailySchedule: data, loading: false }),
          error: (e: Error) => patchState(store, { error: e.message, loading: false }),
        })
      ))
    )),

    loadRevenue: rxMethod<ReportFilter>(pipe(
      tap(filter => patchState(store, { loading: true, activeFilter: filter })),
      switchMap(filter => api.getRevenue(filter).pipe(
        tapResponse({
          next: data => patchState(store, { revenue: data, loading: false }),
          error: (e: Error) => patchState(store, { error: e.message, loading: false }),
        })
      ))
    )),

    loadArAging: rxMethod<void>(pipe(
      tap(() => patchState(store, { loading: true })),
      switchMap(() => api.getArAging().pipe(
        tapResponse({
          next: data => patchState(store, { arAging: data, loading: false }),
          error: (e: Error) => patchState(store, { error: e.message, loading: false }),
        })
      ))
    )),

    loadOutstandingTasks: rxMethod<void>(pipe(
      switchMap(() => api.getOutstandingTasks().pipe(
        tapResponse({
          next: data => patchState(store, { outstandingTasks: data }),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    loadProviderProductivity: rxMethod<ReportFilter>(pipe(
      tap(filter => patchState(store, { loading: true, activeFilter: filter })),
      switchMap(filter => api.getProviderProductivity(filter).pipe(
        tapResponse({
          next: data => patchState(store, { providerProductivity: data, loading: false }),
          error: (e: Error) => patchState(store, { error: e.message, loading: false }),
        })
      ))
    )),

    clearError() {
      patchState(store, { error: null });
    },
  }))
);
