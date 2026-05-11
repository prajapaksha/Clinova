import { computed, inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { withEntities, setAllEntities, setEntity } from '@ngrx/signals/entities';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { pipe, switchMap, tap } from 'rxjs';
import type { Invoice, InvoiceId, InvoiceFilters, InsuranceClaim, ClaimStatus, FeeSchedule } from '@clinova/billing/domain';
import { InvoiceStatus } from '@clinova/billing/domain';
import { BillingApiService, type TakePaymentDto, type ApplyAdjustmentDto } from './billing.api';

interface BillingState {
  selectedInvoiceId: string | null;
  claims: InsuranceClaim[];
  feeSchedules: FeeSchedule[];
  arAgingBuckets: Array<{ label: string; totalCents: number; invoiceCount: number }>;
  arTotalCents: number;
  loading: boolean;
  error: string | null;
  total: number;
}

export const BillingStore = signalStore(
  { providedIn: 'root' },
  withEntities<Invoice>(),
  withState<BillingState>({
    selectedInvoiceId: null,
    claims: [],
    feeSchedules: [],
    arAgingBuckets: [],
    arTotalCents: 0,
    loading: false,
    error: null,
    total: 0,
  }),
  withComputed(({ entities, selectedInvoiceId }) => ({
    selectedInvoice: computed(() => entities().find(i => i.id === selectedInvoiceId()) ?? null),

    overdueInvoices: computed(() =>
      entities().filter(i => i.status === InvoiceStatus.Overdue)
    ),

    outstandingBalanceCents: computed(() =>
      entities().reduce((sum, i) => sum + i.balanceCents, 0)
    ),

    draftInvoices: computed(() =>
      entities().filter(i => i.status === InvoiceStatus.Draft)
    ),
  })),
  withMethods((store, api = inject(BillingApiService)) => ({
    loadInvoices: rxMethod<InvoiceFilters>(pipe(
      tap(() => patchState(store, { loading: true, error: null })),
      switchMap(filters => api.getInvoices(filters).pipe(
        tapResponse({
          next: result => patchState(store, setAllEntities(result.invoices), { total: result.total, loading: false }),
          error: (e: Error) => patchState(store, { error: e.message, loading: false }),
        })
      ))
    )),

    loadById: rxMethod<InvoiceId>(pipe(
      switchMap(id => api.findById(id).pipe(
        tapResponse({
          next: invoice => patchState(store, setEntity(invoice)),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    loadClaims: rxMethod<{ status?: ClaimStatus; patientId?: string } | void>(pipe(
      switchMap(filters => api.getClaims(filters ?? undefined).pipe(
        tapResponse({
          next: claims => patchState(store, { claims }),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    loadFeeSchedules: rxMethod<void>(pipe(
      switchMap(() => api.getFeeSchedules().pipe(
        tapResponse({
          next: schedules => patchState(store, { feeSchedules: schedules }),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    loadArAging: rxMethod<void>(pipe(
      switchMap(() => api.getArAging().pipe(
        tapResponse({
          next: result => patchState(store, { arAgingBuckets: result.buckets, arTotalCents: result.totalCents }),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    takePayment: rxMethod<TakePaymentDto>(pipe(
      tap(() => patchState(store, { loading: true, error: null })),
      switchMap(dto => api.takePayment(dto).pipe(
        tapResponse({
          next: () => patchState(store, { loading: false }),
          error: (e: Error) => patchState(store, { error: e.message, loading: false }),
        })
      ))
    )),

    applyAdjustment: rxMethod<{ invoiceId: InvoiceId; dto: ApplyAdjustmentDto }>(pipe(
      switchMap(({ invoiceId, dto }) => api.applyAdjustment(invoiceId, dto).pipe(
        tapResponse({
          next: invoice => patchState(store, setEntity(invoice)),
          error: (e: Error) => patchState(store, { error: e.message }),
        })
      ))
    )),

    selectInvoice(id: string) {
      patchState(store, { selectedInvoiceId: id });
    },

    clearError() {
      patchState(store, { error: null });
    },
  }))
);
