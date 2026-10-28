import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter, forkJoin } from 'rxjs';
import type { Invoice, Payment } from '@clinova/billing/domain';
import { InvoiceStatus, isInvoiceOpen } from '@clinova/billing/domain';
import { BillingApiService } from '@clinova/billing/data-access';
import { CentsPipe, StatusChipComponent, TakePaymentDialog, type TakePaymentDialogData } from '@clinova/billing/feature-billing';
import { PatientStore } from '@clinova/patient/data-access';
import { AuthService } from '@clinova/auth';

@Component({
  selector: 'clv-billing-tab',
  standalone: true,
  imports: [DatePipe, RouterModule, MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule, CentsPipe, StatusChipComponent],
  templateUrl: './billing-tab.component.html',
  styleUrl: './billing-tab.component.scss',
})
export class BillingTab {
  protected readonly store = inject(PatientStore);
  private readonly api = inject(BillingApiService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  protected readonly patient = computed(() => this.store.selectedPatient());
  private readonly role = computed(() => this.auth.currentUser()?.role ?? '');
  protected readonly canView = computed(() => ['ADMIN', 'BILLING', 'STAFF', 'PHYSICIAN'].includes(this.role()));
  protected readonly canTakePayment = computed(() => ['ADMIN', 'BILLING', 'STAFF'].includes(this.role()));
  protected readonly canManage = computed(() => ['ADMIN', 'BILLING'].includes(this.role()));

  protected readonly invoices = signal<Invoice[]>([]);
  protected readonly payments = signal<Payment[]>([]);
  protected readonly loading = signal(false);

  protected readonly openInvoices = computed(() => this.invoices().filter(i => isInvoiceOpen(i.status)));
  protected readonly balance = computed(() => this.openInvoices().reduce((s, i) => s + i.balanceCents, 0));
  protected readonly overdue = computed(() =>
    this.invoices().filter(i => i.status === InvoiceStatus.Overdue).reduce((s, i) => s + i.balanceCents, 0));
  protected readonly credit = computed(() =>
    this.payments().filter(p => !p.voidedAt).reduce((s, p) => s + p.unappliedCents, 0));
  protected readonly lastPayment = computed(() =>
    this.payments().find(p => !p.voidedAt && p.method !== 'INSURANCE') ?? null);

  constructor() {
    effect(() => {
      const p = this.patient();
      if (p && this.canView()) untracked(() => this.load(p.id));
    });
  }

  protected takePayment(): void {
    const p = this.patient();
    if (!p) return;
    const data: TakePaymentDialogData = { patientId: p.id, patientName: `${p.firstName} ${p.lastName}` };
    this.dialog.open(TakePaymentDialog, { data, width: '640px' }).afterClosed().pipe(filter(Boolean)).subscribe(() => {
      this.snack.open('Payment recorded.', undefined, { duration: 3000 });
      this.load(p.id);
    });
  }

  private load(patientId: string): void {
    this.loading.set(true);
    forkJoin({
      invoices: this.api.getInvoices({ patientId, limit: 200 }),
      payments: this.canTakePayment() ? this.api.getPayments({ patientId, limit: 200 }) : [[] as Payment[]],
    }).subscribe({
      next: ({ invoices, payments }) => {
        this.invoices.set(invoices.invoices);
        this.payments.set(payments);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}