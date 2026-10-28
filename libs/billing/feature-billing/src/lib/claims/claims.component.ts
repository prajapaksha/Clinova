import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter } from 'rxjs';
import type { InsuranceClaim } from '@clinova/billing/domain';
import { ClaimStatus } from '@clinova/billing/domain';
import { BillingApiService } from '@clinova/billing/data-access';
import { CentsPipe } from '../shared/cents.pipe';
import { StatusChipComponent } from '../shared/status-chip.component';
import { ClaimUpdateDialog } from '../dialogs/claim-update-dialog.component';

const PIPELINE: Array<{ status: ClaimStatus; label: string }> = [
  { status: ClaimStatus.Draft, label: 'Draft' },
  { status: ClaimStatus.Submitted, label: 'Submitted' },
  { status: ClaimStatus.Pending, label: 'Pending' },
  { status: ClaimStatus.Denied, label: 'Denied' },
  { status: ClaimStatus.Appealed, label: 'Appealed' },
  { status: ClaimStatus.Paid, label: 'Paid' },
];

/** PRD §4.5 Insurance Claim Tracker — list view with status pipeline. */
@Component({
  selector: 'clv-claims',
  standalone: true,
  imports: [DatePipe, RouterModule, MatButtonModule, MatIconModule, MatProgressBarModule, CentsPipe, StatusChipComponent],
  template: `
    <div class="cl">
      <h1 class="cl__title">Insurance claims</h1>
      <p class="cl__sub">Claims are tracked manually: submit them on the payer portal, then record the outcome here.</p>

      <nav class="pipe" aria-label="Claim status">
        @for (p of pipeline; track p.status) {
          <button type="button" class="pipe__step" [class.pipe__step--active]="active() === p.status" [attr.data-status]="p.status"
                  (click)="active.set(p.status)" [attr.aria-pressed]="active() === p.status">
            <span class="pipe__count">{{ counts()[p.status] ?? 0 }}</span>
            <span class="pipe__label">{{ p.label }}</span>
            <span class="pipe__amount">{{ (amounts()[p.status] ?? 0) | cents:'compact' }}</span>
          </button>
        }
      </nav>

      <div class="cl__table">
        @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
        <table>
          <thead><tr><th>Invoice</th><th>Patient</th><th>Payer</th><th class="num">Billed</th><th>Status</th><th>Submitted</th><th class="num">Paid</th><th></th></tr></thead>
          <tbody>
            @for (c of visible(); track c.id) {
              <tr>
                <td><a [routerLink]="['/billing/invoices', c.invoiceId]" class="mono">{{ c.invoiceNumber }}</a></td>
                <td>{{ c.patientName }}</td>
                <td>{{ c.payerName }}<small>{{ c.policyNumber }}</small></td>
                <td class="num">{{ c.billedCents | cents }}</td>
                <td><clv-status-chip [status]="c.status" />@if (c.denialReason) { <small>{{ c.denialReason }}</small> }</td>
                <td>{{ c.submittedAt ? (c.submittedAt | date:'MMM d, y') : '—' }}</td>
                <td class="num">{{ c.paidAmountCents ? (c.paidAmountCents | cents) : '—' }}</td>
                <td class="act">
                  @if (c.status !== 'PAID' && c.status !== 'VOIDED') {
                    <button mat-stroked-button type="button" (click)="update(c)">{{ c.status === 'DRAFT' ? 'Submit' : 'Update' }}</button>
                  }
                </td>
              </tr>
            } @empty {
              @if (!loading()) { <tr><td colspan="8" class="empty">No {{ activeLabel().toLowerCase() }} claims.</td></tr> }
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: `
    .cl { padding: 24px; }
    .cl__title { margin: 0; font-size: 1.5rem; }
    .cl__sub { margin: 4px 0 20px; color: var(--clv-gray-600); font-size: 0.9rem; }
    .pipe { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 16px; }
    .pipe__step {
      display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 12px 14px; cursor: pointer;
      background: #fff; border: 1px solid var(--clv-gray-200); border-radius: 10px; font: inherit; text-align: left;
      border-top: 4px solid var(--clv-gray-300);
    }
    .pipe__step[data-status='SUBMITTED'], .pipe__step[data-status='PENDING'] { border-top-color: var(--clv-info-text); }
    .pipe__step[data-status='DENIED'] { border-top-color: var(--clv-danger-text); }
    .pipe__step[data-status='APPEALED'] { border-top-color: var(--clv-warning-text); }
    .pipe__step[data-status='PAID'] { border-top-color: var(--clv-success-text); }
    .pipe__step--active { background: var(--clv-primary-50); border-color: var(--clv-primary-300); }
    .pipe__count { font-size: 1.4rem; font-weight: 700; }
    .pipe__label { font-size: 0.8rem; color: var(--clv-gray-700); }
    .pipe__amount { font-size: 0.75rem; color: var(--clv-gray-500); }
    .cl__table { background: #fff; border: 1px solid var(--clv-gray-200); border-radius: 12px; overflow: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th { padding: 10px 16px; text-align: left; font-size: 0.72rem; text-transform: uppercase; color: var(--clv-gray-600); background: var(--clv-gray-50); }
    td { padding: 10px 16px; border-top: 1px solid var(--clv-gray-100); }
    td small { display: block; color: var(--clv-gray-600); }
    .num { text-align: right; }
    .act { text-align: right; }
    .mono { font-family: 'Roboto Mono', ui-monospace, monospace; color: var(--clv-primary-700); }
    .empty { text-align: center; padding: 40px; color: var(--clv-gray-500); }
    @media (max-width: 900px) { .pipe { grid-template-columns: repeat(3, 1fr); } }
  `,
})
export class ClaimsComponent {
  private readonly api = inject(BillingApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  protected readonly pipeline = PIPELINE;
  protected readonly claims = signal<InsuranceClaim[]>([]);
  protected readonly loading = signal(false);
  protected readonly active = signal<ClaimStatus>(ClaimStatus.Draft);

  protected readonly visible = computed(() => this.claims().filter(c => c.status === this.active()));
  protected readonly activeLabel = computed(() => PIPELINE.find(p => p.status === this.active())?.label ?? '');
  protected readonly counts = computed(() => this.claims().reduce<Partial<Record<string, number>>>((acc, c) => ({ ...acc, [c.status]: (acc[c.status] ?? 0) + 1 }), {}));
  protected readonly amounts = computed(() => this.claims().reduce<Partial<Record<string, number>>>((acc, c) => ({ ...acc, [c.status]: (acc[c.status] ?? 0) + c.billedCents }), {}));

  constructor() {
    this.load();
  }

  protected update(claim: InsuranceClaim): void {
    this.dialog.open(ClaimUpdateDialog, { data: claim, width: '520px' }).afterClosed()
      .pipe(filter((c): c is InsuranceClaim => !!c))
      .subscribe(c => {
        this.snack.open(`Claim marked ${c.status.toLowerCase()}.`, undefined, { duration: 3000 });
        this.load();
      });
  }

  private load(): void {
    this.loading.set(true);
    this.api.getClaims().subscribe({
      next: c => {
        this.claims.set(c);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
