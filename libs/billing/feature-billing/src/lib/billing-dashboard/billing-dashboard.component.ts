import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, PercentPipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { filter } from 'rxjs';
import type { BillingSummary, Invoice, PayerCategory } from '@clinova/billing/domain';
import { isInvoiceOpen } from '@clinova/billing/domain';
import { BillingApiService } from '@clinova/billing/data-access';
import type { Patient } from '@clinova/patient/domain';
import { CentsPipe } from '../shared/cents.pipe';
import { StatusChipComponent } from '../shared/status-chip.component';
import { BillingPermissions } from '../shared/billing-shared';
import { TakePaymentDialog, type TakePaymentDialogData } from '../take-payment-dialog/take-payment-dialog.component';
import { PatientPickerDialog } from '../dialogs/patient-picker-dialog.component';

const PAYER_LABELS: Record<PayerCategory, string> = {
  PRIVATE: 'Private insurance',
  MEDICARE: 'Medicare',
  MEDICAID: 'Medicaid',
  SELF_PAY: 'Self-pay',
};
const PAYER_COLORS: Record<PayerCategory, string> = {
  PRIVATE: 'var(--clv-primary-700)',
  MEDICARE: 'var(--clv-primary-300)',
  MEDICAID: '#90caf9',
  SELF_PAY: 'var(--clv-gray-400)',
};
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

@Component({
  selector: 'clv-billing-dashboard',
  standalone: true,
  imports: [
    DatePipe, PercentPipe, RouterModule, MatButtonModule, MatIconModule, MatMenuModule, MatProgressBarModule,
    CentsPipe, StatusChipComponent,
  ],
  templateUrl: './billing-dashboard.component.html',
  styleUrl: './billing-dashboard.component.scss',
})
export class BillingDashboardComponent {
  private readonly api = inject(BillingApiService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  protected readonly perms = inject(BillingPermissions);

  protected readonly summary = signal<BillingSummary | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly isOpen = isInvoiceOpen;

  protected readonly arTrend = computed(() => {
    const s = this.summary();
    if (!s || s.arThirtyDaysAgoCents <= 0) return null;
    return (s.totalArCents - s.arThirtyDaysAgoCents) / s.arThirtyDaysAgoCents;
  });

  protected readonly agingMax = computed(() => Math.max(1, ...(this.summary()?.aging ?? []).map(b => b.totalCents)));

  protected readonly trend = computed(() => {
    const months = this.summary()?.revenueTrend ?? [];
    const max = Math.max(1, ...months.flatMap(m => [m.chargedCents, m.collectedCents]));
    return months.map(m => ({
      ...m,
      label: MONTHS[Number(m.month.slice(5, 7)) - 1],
      chargedPct: (m.chargedCents / max) * 100,
      collectedPct: (m.collectedCents / max) * 100,
    }));
  });

  protected readonly payerMix = computed(() => {
    const mix = this.summary()?.payerMix ?? [];
    let start = 0;
    const segments = mix.map(m => {
      const seg = `${PAYER_COLORS[m.category]} ${start * 360}deg ${(start + m.share) * 360}deg`;
      start += m.share;
      return seg;
    });
    return {
      entries: mix.map(m => ({ ...m, label: PAYER_LABELS[m.category], color: PAYER_COLORS[m.category] })),
      gradient: segments.length ? `conic-gradient(${segments.join(', ')})` : 'var(--clv-gray-100)',
      top: mix.reduce<(typeof mix)[number] | null>((best, m) => (!best || m.share > best.share ? m : best), null),
    };
  });

  protected readonly payerLabel = (c: PayerCategory) => PAYER_LABELS[c];

  private readonly cents = new CentsPipe();
  protected readonly trendLabel = computed(() =>
    'Charged and collected by month: ' +
    this.trend().map(m => `${m.label} ${this.cents.transform(m.chargedCents)} / ${this.cents.transform(m.collectedCents)}`).join(', '));
  protected readonly mixLabel = computed(() =>
    'Charges by payer: ' + this.payerMix().entries.map(e => `${e.label} ${Math.round(e.share * 100)}%`).join(', '));

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getSummary().subscribe({
      next: s => {
        this.summary.set(s);
        this.error.set(false);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  protected takePayment(invoice?: Invoice): void {
    const data: TakePaymentDialogData = invoice
      ? { patientId: invoice.patientId, patientName: invoice.patientName, invoiceIds: [invoice.id] }
      : {};
    this.dialog.open(TakePaymentDialog, { data, width: '640px' }).afterClosed()
      .pipe(filter(Boolean))
      .subscribe(() => this.load());
  }

  protected generateStatement(): void {
    this.dialog.open(PatientPickerDialog, { data: { title: 'Generate statement', action: 'Open statement' }, width: '480px' })
      .afterClosed()
      .pipe(filter((p): p is Patient => !!p))
      .subscribe(p => this.router.navigate(['/billing/statements', p.id]));
  }

  protected initials(name = ''): string {
    return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }
}
