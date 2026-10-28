import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { Invoice } from '@clinova/billing/domain';
import { PortalApiService } from '@clinova/portal/data-access';
import { CentsPipe, INVOICE_STATUS, errorMessage } from '../shared/portal-shared';

const ADJUSTMENT_LABELS: Record<string, string> = {
  INSURANCE_CONTRACTUAL: 'Insurance adjustment',
  WRITEOFF: 'Write-off',
  COURTESY_DISCOUNT: 'Courtesy discount',
  BAD_DEBT: 'Balance adjustment',
};

@Component({
  selector: 'clv-portal-invoice',
  imports: [DatePipe, RouterModule, MatButtonModule, MatIconModule, CentsPipe],
  template: `
    <div class="pp-noprint iv__bar">
      <a mat-button routerLink="/billing" class="pp-back"><mat-icon>arrow_back</mat-icon> Billing</a>
      @if (inv()) { <button mat-stroked-button type="button" (click)="print()"><mat-icon>print</mat-icon> Print</button> }
    </div>
    @if (error()) { <p class="pp-note pp-note--warn">{{ error() }}</p> }
    @if (inv(); as i) {
      <article class="pp-card iv">
        <header class="pp-head">
          <div>
            <h1 class="pp-title">Bill {{ i.number }}</h1>
            <p class="pp-sub">Visit on {{ i.serviceDate | date:'MMMM d, y' }} with {{ i.providerName }}</p>
          </div>
          <span [class]="'pp-badge pp-badge--' + status().tone">{{ status().label }}</span>
        </header>
        <table class="iv__table">
          <thead><tr><th>Service</th><th class="num">Amount</th></tr></thead>
          <tbody>
            @for (l of i.lines; track l.id) {
              <tr><td>{{ l.description }}@if (l.quantity > 1) { × {{ l.quantity }} }</td><td class="num">{{ l.totalCents | cents }}</td></tr>
            }
            @for (a of i.adjustments; track a.id) {
              <tr class="iv__credit"><td>{{ adjustment(a.type) }}</td><td class="num">−{{ a.amountCents | cents }}</td></tr>
            }
            @for (p of i.payments; track p.paymentId) {
              @if (!p.voided) {
                <tr class="iv__credit"><td>{{ p.method === 'INSURANCE' ? 'Paid by insurance' : 'Payment' }} · {{ p.processedAt | date:'MMM d, y' }}</td><td class="num">−{{ p.amountCents | cents }}</td></tr>
              }
            }
          </tbody>
          <tfoot><tr><th>You owe</th><th class="num">{{ i.balanceCents | cents }}</th></tr></tfoot>
        </table>
        @if (i.dueDate && i.balanceCents > 0) { <p class="pp-muted">Please pay by {{ i.dueDate | date:'MMMM d, y' }}.</p> }
        @if (i.balanceCents > 0) {
          <div class="pp-actions pp-noprint">
            <a mat-button routerLink="/messages/new" [queryParams]="{ category: 'BILLING', subject: 'Question about bill ' + i.number }">Question about this bill?</a>
            <a mat-flat-button color="primary" routerLink="/billing/pay" [queryParams]="{ invoiceId: i.id }">Pay {{ i.balanceCents | cents }}</a>
          </div>
        }
      </article>
    }
  `,
  styles: `
    .iv__bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .iv { max-width: 760px; }
    .iv__table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
    .iv__table th, .iv__table td { padding: 10px 4px; border-bottom: 1px solid var(--clv-gray-100); text-align: left; }
    .iv__table thead th { font-size: 12px; text-transform: uppercase; color: var(--clv-gray-600); }
    .iv__table tfoot th { font-size: 18px; border-bottom: 0; }
    .num { text-align: right !important; font-variant-numeric: tabular-nums; }
    .iv__credit td { color: var(--clv-success-text); }
  `,
})
export class PortalInvoicePage {
  private readonly api = inject(PortalApiService);
  readonly id = input.required<string>();
  protected readonly inv = signal<Invoice | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly status = computed(() => INVOICE_STATUS[this.inv()?.status ?? ''] ?? { label: this.inv()?.status ?? '', tone: '' });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.api.invoice(id).subscribe({ next: i => this.inv.set(i), error: err => this.error.set(errorMessage(err)) }));
    });
  }

  protected adjustment(type: string): string {
    return ADJUSTMENT_LABELS[type] ?? 'Adjustment';
  }

  protected print(): void {
    window.print();
  }
}
