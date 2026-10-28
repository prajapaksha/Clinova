import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { Invoice, Payment } from '@clinova/billing/domain';
import type { BillingSummary } from '@clinova/portal/data-access';
import { PortalApiService } from '@clinova/portal/data-access';
import type { SavedCard } from '@clinova/portal/domain';
import { CentsPipe, INVOICE_STATUS, errorMessage } from '../shared/portal-shared';
import { CardForm } from './card-form';

const OPEN = ['SENT', 'PARTIALLY_PAID', 'OVERDUE'];

@Component({
  selector: 'clv-portal-billing',
  imports: [DatePipe, RouterModule, MatButtonModule, MatIconModule, CentsPipe, CardForm],
  templateUrl: './billing.page.html',
  styles: `
    .bl__top { display: grid; grid-template-columns: 1fr 2fr; gap: 16px; align-items: start; }
    .bl__top .pp-card + .pp-card { margin-top: 0; }
    .bl__big { font-size: 36px; font-weight: 700; margin: 4px 0; }
    .bl__credit { color: var(--clv-success-text); }
    .bl__amount { font-weight: 700; text-align: right; }
    .bl__card { display: flex; align-items: center; gap: 12px; }
    .bl__add { margin-top: 12px; }
    .pp-empty { display: block !important; }
    @media (max-width: 860px) { .bl__top { grid-template-columns: 1fr; } }
  `,
})
export class PortalBillingPage {
  private readonly api = inject(PortalApiService);
  private readonly snack = inject(MatSnackBar);
  private readonly cardForm = viewChild(CardForm);

  protected readonly summary = signal<BillingSummary | null>(null);
  protected readonly invoices = signal<Invoice[]>([]);
  protected readonly payments = signal<Payment[]>([]);
  protected readonly cards = signal<SavedCard[]>([]);
  protected readonly adding = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly open = computed(() => this.invoices().filter(i => OPEN.includes(i.status)));
  protected readonly closed = computed(() => this.invoices().filter(i => !OPEN.includes(i.status)));

  constructor() {
    this.load();
  }

  protected status(i: Invoice) {
    return INVOICE_STATUS[i.status] ?? { label: i.status, tone: '' };
  }

  protected paymentLabel(p: Payment): string {
    if (p.method === 'INSURANCE') return 'Insurance payment';
    return p.method === 'PATIENT_PORTAL' ? 'Paid online' : 'Paid at the office';
  }

  protected paymentDetail(p: Payment): string {
    const bills = p.allocations.map(a => a.invoiceNumber).filter(Boolean).join(', ');
    const card = p.method === 'PATIENT_PORTAL' ? p.referenceNumber?.split(' · ')[0] : null;
    return [bills && `Bill ${bills}`, card].filter(Boolean).join(' · ');
  }

  protected saveCard(): void {
    const result = this.cardForm()?.value();
    if (!result || 'error' in result) {
      this.error.set(result?.error ?? null);
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.api.addCard(result.card).subscribe({
      next: () => {
        this.busy.set(false);
        this.adding.set(false);
        this.snack.open('Card saved.', 'OK', { duration: 3000 });
        this.api.cards().subscribe(c => this.cards.set(c));
      },
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  protected makeDefault(card: SavedCard): void {
    this.api.setDefaultCard(card.id).subscribe(c => this.cards.set(c));
  }

  protected remove(card: SavedCard): void {
    if (!confirm(`Remove ${card.brand} ending in ${card.last4}?`)) return;
    this.api.removeCard(card.id).subscribe(() => this.api.cards().subscribe(c => this.cards.set(c)));
  }

  private load(): void {
    this.api.billingSummary().subscribe({ next: s => this.summary.set(s), error: err => this.error.set(errorMessage(err)) });
    this.api.invoices().subscribe(i => this.invoices.set(i));
    this.api.payments().subscribe(p => this.payments.set(p));
    this.api.cards().subscribe(c => this.cards.set(c));
  }
}
