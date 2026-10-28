import { Component, computed, inject, input, OnInit, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import type { Invoice, Payment } from '@clinova/billing/domain';
import type { BillingSummary, PayInput } from '@clinova/portal/data-access';
import { PortalApiService } from '@clinova/portal/data-access';
import type { SavedCard } from '@clinova/portal/domain';
import { CentsPipe, errorMessage } from '../shared/portal-shared';
import { CardForm } from './card-form';

type AmountChoice = 'all' | 'bill' | 'other';

/** Pay Now flow (PRD §4.8): amount → payment method → receipt. */
@Component({
  selector: 'clv-portal-pay',
  imports: [DatePipe, FormsModule, RouterModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatRadioModule, CentsPipe, CardForm],
  templateUrl: './pay.page.html',
  styles: `
    .py { max-width: 640px; }
    .py__group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px; }
    .py__other { max-width: 220px; margin-left: 32px; }
    .py__new { margin: 8px 0 0 32px; }
    .py__total { display: flex; justify-content: space-between; align-items: center; font-size: 18px; font-weight: 700; padding: 14px 0; border-top: 1px solid var(--clv-gray-200); margin-top: 16px; }
    .py__secure { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--clv-gray-600); }
    .py__done { text-align: center; }
    .py__check { color: var(--clv-success-text); font-size: 56px; width: 56px; height: 56px; }
    .py__receipt { text-align: left; margin: 16px auto; max-width: 420px; }
  `,
})
export class PortalPayPage implements OnInit {
  private readonly api = inject(PortalApiService);
  private readonly cardForm = viewChild(CardForm);

  readonly invoiceId = input<string>();

  protected readonly summary = signal<BillingSummary | null>(null);
  protected readonly bill = signal<Invoice | null>(null);
  protected readonly cards = signal<SavedCard[]>([]);
  protected readonly amountChoice = signal<AmountChoice>('all');
  protected otherAmount: number | null = null;
  protected readonly method = signal<string>('new');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly receipt = signal<Payment | null>(null);

  protected readonly usableCards = computed(() => this.cards().filter(c => !c.isExpired));
  protected readonly amountCents = computed(() => {
    const s = this.summary();
    if (!s) return 0;
    if (this.amountChoice() === 'bill') return this.bill()?.balanceCents ?? 0;
    if (this.amountChoice() === 'other') return Math.round((this.otherValue() ?? 0) * 100);
    return s.balanceCents;
  });
  private readonly otherValue = signal<number | null>(null);

  ngOnInit(): void {
    this.api.billingSummary().subscribe({ next: s => this.summary.set(s), error: err => this.error.set(errorMessage(err)) });
    this.api.cards().subscribe(cards => {
      this.cards.set(cards);
      const preferred = cards.find(c => c.isDefault && !c.isExpired) ?? cards.find(c => !c.isExpired);
      if (preferred) this.method.set(preferred.id);
    });
    const id = this.invoiceId();
    if (id) {
      this.api.invoice(id).subscribe(inv => {
        this.bill.set(inv);
        this.amountChoice.set('bill');
      });
    }
  }

  protected setOther(value: number | null): void {
    this.otherAmount = value;
    this.otherValue.set(value);
  }

  protected pay(): void {
    const amount = this.amountCents();
    const balance = this.summary()?.balanceCents ?? 0;
    if (amount <= 0) {
      this.error.set('Enter an amount to pay.');
      return;
    }
    if (amount > balance) {
      this.error.set('The amount is more than your balance due.');
      return;
    }
    const dto: PayInput = { amountCents: amount };
    if (this.amountChoice() === 'bill' && this.bill()) dto.invoiceIds = [this.bill()?.id as string];
    if (this.method() === 'new') {
      const result = this.cardForm()?.value();
      if (!result || 'error' in result) {
        this.error.set(result?.error ?? 'Enter your card details.');
        return;
      }
      dto.card = result.card;
      dto.saveCard = result.save;
    } else {
      dto.savedCardId = this.method();
    }
    this.busy.set(true);
    this.error.set(null);
    this.api.pay(dto).subscribe({
      next: payment => {
        this.busy.set(false);
        this.receipt.set(payment);
      },
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err, 'The payment could not be completed.'));
      },
    });
  }

  protected print(): void {
    window.print();
  }
}
