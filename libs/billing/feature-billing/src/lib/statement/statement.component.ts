import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { PatientStatement } from '@clinova/billing/domain';
import { BillingApiService } from '@clinova/billing/data-access';
import { CentsPipe } from '../shared/cents.pipe';
import { errorMessage } from '../shared/billing-shared';

/** Printable patient statement of open invoices (PRD §4.5 Statements). */
@Component({
  selector: 'clv-statement',
  standalone: true,
  imports: [DatePipe, RouterModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, CentsPipe],
  template: `
    @if (error()) {
      <p class="st__error" role="alert">{{ error() }}</p>
    } @else if (statement(); as s) {
      <div class="st__toolbar">
        <a mat-button [routerLink]="['/patients', s.patientId, 'billing']"><mat-icon>arrow_back</mat-icon> Patient billing</a>
        <button mat-flat-button color="primary" type="button" (click)="print()"><mat-icon>print</mat-icon> Print / Save PDF</button>
      </div>
      <article class="st">
        <header class="st__head">
          <div>
            <h1 class="st__brand">Clinova Health</h1>
            <p class="st__muted">Patient statement</p>
          </div>
          <dl class="st__facts">
            <dt>Statement date</dt><dd>{{ s.generatedAt | date:'MMM d, y' }}</dd>
            <dt>Account</dt><dd>{{ s.patientMrn }}</dd>
            <dt>Amount due</dt><dd class="st__due">{{ s.totalBalanceCents - s.creditCents > 0 ? (s.totalBalanceCents - s.creditCents | cents) : (0 | cents) }}</dd>
          </dl>
        </header>

        <section class="st__to">
          <strong>{{ s.patientName }}</strong>
          @if (s.address) { <span class="st__addr">{{ s.address }}</span> }
        </section>

        <table class="st__table">
          <thead><tr><th>Service date</th><th>Invoice</th><th class="num">Charges</th><th class="num">Adjustments</th><th class="num">Payments</th><th class="num">Balance</th><th>Due</th></tr></thead>
          <tbody>
            @for (inv of s.invoices; track inv.id) {
              <tr>
                <td>{{ inv.serviceDate | date:'MMM d, y' }}</td>
                <td class="mono">{{ inv.number }}</td>
                <td class="num">{{ inv.subtotalCents | cents }}</td>
                <td class="num">{{ inv.totalAdjustmentsCents ? '−' + (inv.totalAdjustmentsCents | cents) : '—' }}</td>
                <td class="num">{{ inv.totalPaidCents ? '−' + (inv.totalPaidCents | cents) : '—' }}</td>
                <td class="num"><strong>{{ inv.balanceCents | cents }}</strong></td>
                <td [class.st__overdue]="inv.status === 'OVERDUE'">{{ inv.dueDate | date:'MMM d' }}@if (inv.status === 'OVERDUE') { · overdue }</td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="st__empty">No outstanding balance. Thank you!</td></tr>
            }
          </tbody>
        </table>

        <dl class="st__totals">
          <dt>Open balance</dt><dd>{{ s.totalBalanceCents | cents }}</dd>
          @if (s.creditCents > 0) { <dt>Account credit</dt><dd>−{{ s.creditCents | cents }}</dd> }
          <dt class="st__grand">Total due</dt><dd class="st__grand">{{ s.totalBalanceCents - s.creditCents > 0 ? (s.totalBalanceCents - s.creditCents | cents) : (0 | cents) }}</dd>
        </dl>

        <footer class="st__foot">Questions about your bill? Call the billing office. You can also pay through the Clinova patient portal.</footer>
      </article>
    } @else {
      <div class="st__loading"><mat-spinner diameter="36" /></div>
    }
  `,
  styles: `
    :host { display: block; padding: 24px; }
    .st__toolbar { display: flex; justify-content: space-between; max-width: 860px; margin: 0 auto 12px; }
    .st { max-width: 860px; margin: 0 auto; padding: 40px; background: #fff; border: 1px solid var(--clv-gray-200); border-radius: 12px; }
    .st__head { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 20px; border-bottom: 2px solid var(--clv-primary-700); }
    .st__brand { margin: 0; color: var(--clv-primary-700); font-size: 1.6rem; }
    .st__muted { margin: 2px 0 0; color: var(--clv-gray-600); }
    .st__facts { display: grid; grid-template-columns: auto auto; gap: 4px 16px; margin: 0; font-size: 0.875rem; }
    .st__facts dt { color: var(--clv-gray-600); }
    .st__facts dd { margin: 0; text-align: right; font-weight: 600; }
    .st__due { color: var(--clv-primary-800); font-size: 1.1rem; }
    .st__to { display: flex; flex-direction: column; margin: 24px 0; }
    .st__addr { white-space: pre-line; color: var(--clv-gray-700); }
    .st__table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .st__table th { padding: 8px; text-align: left; font-size: 0.72rem; text-transform: uppercase; color: var(--clv-gray-600); border-bottom: 1px solid var(--clv-gray-300); }
    .st__table td { padding: 8px; border-bottom: 1px solid var(--clv-gray-100); }
    .num { text-align: right; white-space: nowrap; }
    .mono { font-family: 'Roboto Mono', ui-monospace, monospace; }
    .st__overdue { color: var(--clv-danger-text); font-weight: 600; }
    .st__empty { text-align: center; padding: 24px; color: var(--clv-gray-600); }
    .st__totals { display: grid; grid-template-columns: 1fr auto; gap: 6px 24px; max-width: 300px; margin: 20px 0 0 auto; }
    .st__totals dd { margin: 0; text-align: right; }
    .st__grand { padding-top: 8px; border-top: 1px solid var(--clv-gray-300); font-weight: 700; font-size: 1.1rem; }
    .st__foot { margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--clv-gray-200); font-size: 0.8rem; color: var(--clv-gray-600); }
    .st__loading { display: flex; justify-content: center; padding: 64px; }
    .st__error { color: var(--clv-danger-text); text-align: center; padding: 48px; }
    @media print {
      :host { padding: 0; }
      .st__toolbar { display: none; }
      .st { border: none; padding: 0; max-width: none; }
    }
  `,
})
export class StatementComponent {
  private readonly api = inject(BillingApiService);
  readonly patientId = input.required<string>();

  protected readonly statement = signal<PatientStatement | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.patientId();
      untracked(() => this.api.getStatement(id).subscribe({
        next: s => this.statement.set(s),
        error: err => this.error.set(errorMessage(err, 'The statement could not be generated.')),
      }));
    });
  }

  protected print(): void {
    window.print();
  }
}
