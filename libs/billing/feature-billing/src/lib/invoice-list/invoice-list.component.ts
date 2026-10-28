import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import type { Invoice } from '@clinova/billing/domain';
import { InvoiceStatus } from '@clinova/billing/domain';
import { BillingApiService } from '@clinova/billing/data-access';
import { CentsPipe } from '../shared/cents.pipe';
import { StatusChipComponent } from '../shared/status-chip.component';
import { BillingPermissions } from '../shared/billing-shared';

const FILTERS: Array<{ value: string; label: string; statuses?: InvoiceStatus[] }> = [
  { value: 'ALL', label: 'All' },
  { value: InvoiceStatus.Draft, label: 'Draft', statuses: [InvoiceStatus.Draft] },
  { value: 'OPEN', label: 'Open', statuses: [InvoiceStatus.Sent, InvoiceStatus.PartiallyPaid, InvoiceStatus.Overdue] },
  { value: InvoiceStatus.Overdue, label: 'Overdue', statuses: [InvoiceStatus.Overdue] },
  { value: InvoiceStatus.Paid, label: 'Paid', statuses: [InvoiceStatus.Paid] },
  { value: InvoiceStatus.Voided, label: 'Voided', statuses: [InvoiceStatus.Voided] },
];

@Component({
  selector: 'clv-invoice-list',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, RouterModule, MatButtonModule, MatButtonToggleModule, MatFormFieldModule,
    MatIconModule, MatInputModule, MatPaginatorModule, MatProgressBarModule, CentsPipe, StatusChipComponent,
  ],
  template: `
    <div class="il">
      <header class="il__header">
        <h1 class="il__title">Invoices</h1>
        @if (perms.canManage()) {
          <a mat-flat-button color="primary" routerLink="new"><mat-icon>add</mat-icon> New invoice</a>
        }
      </header>

      <div class="il__toolbar">
        <mat-button-toggle-group [value]="filter()" (change)="setFilter($event.value)" aria-label="Filter by status" hideSingleSelectionIndicator>
          @for (f of filters; track f.value) { <mat-button-toggle [value]="f.value">{{ f.label }}</mat-button-toggle> }
        </mat-button-toggle-group>
        <mat-form-field appearance="outline" class="il__search" subscriptSizing="dynamic">
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [formControl]="search" placeholder="Invoice #, patient name or MRN" aria-label="Search invoices" />
        </mat-form-field>
      </div>

      <div class="il__table">
        @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
        <table>
          <thead>
            <tr><th>Invoice #</th><th>Service date</th><th>Patient</th><th>Provider</th><th>Status</th><th class="num">Total</th><th class="num">Balance</th><th>Due</th></tr>
          </thead>
          <tbody>
            @for (inv of invoices(); track inv.id) {
              <tr tabindex="0" role="link" [attr.aria-label]="'Open ' + inv.number" (click)="open(inv)" (keydown.enter)="open(inv)">
                <td class="mono">{{ inv.number }}</td>
                <td>{{ inv.serviceDate | date:'MMM d, y' }}</td>
                <td><strong>{{ inv.patientName }}</strong><small>{{ inv.patientMrn }}</small></td>
                <td>{{ inv.providerName }}</td>
                <td><clv-status-chip [status]="inv.status" /></td>
                <td class="num">{{ inv.subtotalCents | cents }}</td>
                <td class="num" [class.due]="inv.balanceCents > 0">{{ inv.balanceCents | cents }}</td>
                <td>{{ inv.dueDate ? (inv.dueDate | date:'MMM d') : '—' }}</td>
              </tr>
            } @empty {
              @if (!loading()) { <tr><td colspan="8" class="il__empty">No invoices match these filters.</td></tr> }
            }
          </tbody>
        </table>
        <mat-paginator [length]="total()" [pageIndex]="pageIndex()" [pageSize]="pageSize()" [pageSizeOptions]="[25, 50, 100]"
                       (page)="onPage($event)" aria-label="Invoice pages" />
      </div>
    </div>
  `,
  styles: `
    .il { padding: 24px; }
    .il__header { display: flex; justify-content: space-between; align-items: center; }
    .il__title { margin: 0; font-size: 1.5rem; font-weight: 600; }
    .il__toolbar { display: flex; align-items: center; gap: 16px; margin: 20px 0 16px; flex-wrap: wrap; }
    .il__search { width: 320px; margin-left: auto; }
    .il__table { background: #fff; border: 1px solid var(--clv-gray-200); border-radius: 12px; overflow: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th { padding: 10px 16px; text-align: left; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--clv-gray-600); background: var(--clv-gray-50); }
    td { padding: 10px 16px; border-top: 1px solid var(--clv-gray-100); }
    td small { display: block; color: var(--clv-gray-600); }
    tbody tr { cursor: pointer; }
    tbody tr:hover, tbody tr:focus-visible { background: var(--clv-primary-50); }
    .num { text-align: right; white-space: nowrap; }
    .due { font-weight: 600; }
    .mono { font-family: 'Roboto Mono', ui-monospace, monospace; color: var(--clv-primary-700); }
    .il__empty { text-align: center; padding: 40px; color: var(--clv-gray-500); cursor: default; }
  `,
})
export class InvoiceListComponent {
  private readonly api = inject(BillingApiService);
  private readonly router = inject(Router);
  protected readonly perms = inject(BillingPermissions);

  /** Optional `?status=` query parameter (e.g. from dashboard links). */
  readonly status = input<string>();

  protected readonly filters = FILTERS;
  protected readonly filter = signal('ALL');
  protected readonly invoices = signal<Invoice[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(25);
  private readonly query = signal('');
  protected readonly search = new FormControl('', { nonNullable: true });

  constructor() {
    effect(() => {
      const s = this.status();
      if (s && FILTERS.some(f => f.value === s)) untracked(() => this.filter.set(s));
    });

    this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed()).subscribe(q => {
      this.pageIndex.set(0);
      this.query.set(q.trim());
    });

    effect(() => {
      const statuses = FILTERS.find(f => f.value === this.filter())?.statuses;
      const params = { status: statuses, search: this.query() || undefined, limit: this.pageSize(), offset: this.pageIndex() * this.pageSize() };
      untracked(() => {
        this.loading.set(true);
        this.api.getInvoices(params).subscribe({
          next: r => {
            this.invoices.set(r.invoices);
            this.total.set(r.total);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      });
    });
  }

  protected setFilter(value: string): void {
    this.filter.set(value);
    this.pageIndex.set(0);
  }

  protected onPage(e: PageEvent): void {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  protected open(inv: Invoice): void {
    this.router.navigate(['/billing/invoices', inv.id]);
  }
}
