import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import type { Invoice, Payment } from '@clinova/billing/domain';
import { InvoiceStatus, PaymentMethod, allocatePayment } from '@clinova/billing/domain';
import { BillingApiService } from '@clinova/billing/data-access';
import type { Patient } from '@clinova/patient/domain';
import { PatientApiService } from '@clinova/patient/data-access';
import { CentsPipe } from '../shared/cents.pipe';
import { DESK_PAYMENT_METHODS, PAYMENT_METHOD_LABELS, centsFromDollars, errorMessage } from '../shared/billing-shared';

export interface TakePaymentDialogData {
  patientId?: string;
  patientName?: string;
  /** Pre-selected invoices; defaults to all open invoices. */
  invoiceIds?: string[];
}

const CARD_METHODS: PaymentMethod[] = [PaymentMethod.CreditCard, PaymentMethod.DebitCard, PaymentMethod.HSA, PaymentMethod.FSA, PaymentMethod.ACH];

/** PRD §4.5 Take Payment: select invoice(s), amount, method, optional receipt. Closes with the Payment. */
@Component({
  selector: 'clv-take-payment-dialog',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, MatAutocompleteModule, MatButtonModule, MatCheckboxModule, MatDialogModule,
    MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule, CentsPipe,
  ],
  templateUrl: './take-payment-dialog.component.html',
  styleUrl: './take-payment-dialog.component.scss',
})
export class TakePaymentDialog {
  protected readonly data = inject<TakePaymentDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly ref = inject(MatDialogRef<TakePaymentDialog, Payment>);
  private readonly api = inject(BillingApiService);
  private readonly patients = inject(PatientApiService);

  protected readonly methods = DESK_PAYMENT_METHODS;
  protected readonly methodLabels = PAYMENT_METHOD_LABELS;

  protected readonly patientId = signal<string | null>(this.data.patientId ?? null);
  protected readonly patientName = signal<string | null>(this.data.patientName ?? null);
  protected readonly patientResults = signal<Patient[]>([]);
  protected readonly openInvoices = signal<Invoice[]>([]);
  protected readonly selectedIds = signal<Set<string>>(new Set());
  protected readonly loadingInvoices = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly patientQuery = new FormControl<string | Patient>('', { nonNullable: true });
  protected readonly form = new FormGroup({
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    method: new FormControl<PaymentMethod>(PaymentMethod.CreditCard, { nonNullable: true }),
    referenceNumber: new FormControl('', { nonNullable: true }),
    checkNumber: new FormControl('', { nonNullable: true }),
    receiptEmail: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
  });

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly method = computed(() => this.formValue().method ?? PaymentMethod.CreditCard);
  protected readonly isCard = computed(() => CARD_METHODS.includes(this.method()));
  protected readonly isCheck = computed(() => this.method() === PaymentMethod.Check);

  protected readonly selected = computed(() => this.openInvoices().filter(i => this.selectedIds().has(i.id)));
  protected readonly selectedTotal = computed(() => this.selected().reduce((s, i) => s + i.balanceCents, 0));
  protected readonly preview = computed(() => {
    const amountCents = centsFromDollars(this.formValue().amount);
    const { allocations, unappliedCents } = allocatePayment(amountCents, this.selected());
    const byId = new Map(allocations.map(a => [a.invoiceId, a.amountCents]));
    return { amountCents, byId, unappliedCents };
  });

  constructor() {
    this.patientQuery.valueChanges.pipe(
      map(q => (typeof q === 'string' ? q.trim() : '')),
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(q => (q.length >= 2 ? this.patients.search({ query: q, limit: 10 }).pipe(map(r => r.patients), catchError(() => of([]))) : of([]))),
      takeUntilDestroyed(),
    ).subscribe(r => this.patientResults.set(r));

    effect(() => {
      const id = this.patientId();
      if (id) untracked(() => this.loadInvoices(id));
    });
  }

  protected displayPatient(p: Patient | string | null): string {
    return !p ? '' : typeof p === 'string' ? p : `${p.firstName} ${p.lastName}`;
  }

  protected pickPatient(e: MatAutocompleteSelectedEvent): void {
    const p = e.option.value as Patient;
    this.patientName.set(`${p.firstName} ${p.lastName}`);
    this.patientId.set(p.id);
    if (p.contact.email) this.form.controls.receiptEmail.setValue(p.contact.email);
  }

  protected toggle(id: string, checked: boolean): void {
    this.selectedIds.update(s => {
      const next = new Set(s);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
    this.form.controls.amount.setValue(this.selectedTotal() / 100 || null);
  }

  protected submit(): void {
    const patientId = this.patientId();
    if (!patientId || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    if (this.isCheck() && !v.checkNumber.trim()) {
      this.error.set('Enter the check number.');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.api.takePayment({
      patientId,
      amountCents: centsFromDollars(v.amount),
      method: v.method,
      invoiceIds: this.selected().length ? this.selected().map(i => i.id) : undefined,
      referenceNumber: this.isCard() ? v.referenceNumber.trim() || undefined : undefined,
      checkNumber: this.isCheck() ? v.checkNumber.trim() : undefined,
      receiptEmail: v.receiptEmail.trim() || undefined,
    }).subscribe({
      next: payment => this.ref.close(payment),
      error: err => {
        this.submitting.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }

  private loadInvoices(patientId: string): void {
    this.loadingInvoices.set(true);
    this.api.getInvoices({
      patientId,
      status: [InvoiceStatus.Sent, InvoiceStatus.PartiallyPaid, InvoiceStatus.Overdue],
      limit: 100,
    }).subscribe({
      next: r => {
        // Oldest first, matching how the server applies unspecified payments.
        const open = [...r.invoices].sort((a, b) => new Date(a.issuedAt ?? 0).getTime() - new Date(b.issuedAt ?? 0).getTime());
        this.openInvoices.set(open);
        const preset = this.data.invoiceIds?.length ? new Set(this.data.invoiceIds) : new Set(open.map(i => i.id));
        this.selectedIds.set(new Set(open.filter(i => preset.has(i.id)).map(i => i.id)));
        this.form.controls.amount.setValue(this.selectedTotal() / 100 || null);
        this.loadingInvoices.set(false);
      },
      error: () => this.loadingInvoices.set(false),
    });
  }
}
