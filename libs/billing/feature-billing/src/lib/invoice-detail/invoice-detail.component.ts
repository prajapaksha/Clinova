import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, filter, switchMap } from 'rxjs';
import type { FeeScheduleLine, Invoice, InvoicePayment } from '@clinova/billing/domain';
import { ClaimStatus, InvoiceStatus, isInvoiceOpen } from '@clinova/billing/domain';
import { BillingApiService } from '@clinova/billing/data-access';
import { Permissions } from '@clinova/auth';
import { CentsPipe } from '../shared/cents.pipe';
import { StatusChipComponent } from '../shared/status-chip.component';
import { BillingPermissions, PAYMENT_METHOD_LABELS, centsFromDollars, errorMessage } from '../shared/billing-shared';
import { TakePaymentDialog, type TakePaymentDialogData } from '../take-payment-dialog/take-payment-dialog.component';
import { AdjustmentDialog } from '../dialogs/adjustment-dialog.component';
import { ReasonDialog, type ReasonDialogData } from '../dialogs/reason-dialog.component';
import { ClaimUpdateDialog } from '../dialogs/claim-update-dialog.component';

interface HistoryEvent {
  at: Date;
  icon: string;
  text: string;
}

const lineGroup = (l?: { serviceCode: string; description: string; quantity: number; unitPriceCents: number }) =>
  new FormGroup({
    serviceCode: new FormControl(l?.serviceCode ?? '', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl(l?.description ?? '', { nonNullable: true }),
    quantity: new FormControl(l?.quantity ?? 1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
    unitPrice: new FormControl<number | null>(l ? l.unitPriceCents / 100 : null, [Validators.min(0)]),
  });

@Component({
  selector: 'clv-invoice-detail',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, RouterModule, MatButtonModule, MatIconModule, MatInputModule, MatMenuModule,
    MatProgressSpinnerModule, MatTooltipModule, CentsPipe, StatusChipComponent,
  ],
  templateUrl: './invoice-detail.component.html',
  styleUrl: './invoice-detail.component.scss',
})
export class InvoiceDetailComponent {
  private readonly api = inject(BillingApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly access = inject(Permissions);
  protected readonly perms = inject(BillingPermissions);

  readonly id = input.required<string>();

  protected readonly invoice = signal<Invoice | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly feeLines = signal<FeeScheduleLine[]>([]);
  protected readonly methodLabels = PAYMENT_METHOD_LABELS;
  protected readonly lines = new FormArray<ReturnType<typeof lineGroup>>([]);

  protected readonly isDraft = computed(() => this.invoice()?.status === InvoiceStatus.Draft);
  protected readonly isOpen = computed(() => {
    const inv = this.invoice();
    return !!inv && isInvoiceOpen(inv.status);
  });
  protected readonly isClinical = computed(() => this.access.can('clinical:notes'));
  protected readonly canFileClaim = computed(() => {
    const inv = this.invoice();
    if (!inv || !this.perms.canManage() || inv.status === InvoiceStatus.Draft || inv.status === InvoiceStatus.Voided) return false;
    return !(inv.claims ?? []).some(c => c.status !== ClaimStatus.Denied && c.status !== ClaimStatus.Voided);
  });

  protected readonly history = computed<HistoryEvent[]>(() => {
    const inv = this.invoice();
    if (!inv) return [];
    const events: HistoryEvent[] = [{ at: inv.createdAt, icon: 'note_add', text: `Created as draft ${inv.number}` }];
    if (inv.issuedAt) events.push({ at: inv.issuedAt, icon: 'send', text: `Issued, due ${new Date(inv.dueDate ?? inv.issuedAt).toLocaleDateString()}` });
    inv.payments.forEach((p: InvoicePayment) => events.push({
      at: p.processedAt, icon: p.voided ? 'money_off' : 'payments',
      text: `${p.voided ? 'Voided payment' : 'Payment'} ${(p.amountCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} · ${PAYMENT_METHOD_LABELS[p.method]}${p.processedByName ? ' · ' + p.processedByName : ''}`,
    }));
    inv.adjustments.forEach(a => events.push({
      at: a.appliedAt, icon: 'price_change',
      text: `Adjustment ${(a.amountCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} · ${a.reason}`,
    }));
    (inv.claims ?? []).forEach(c => {
      if (c.submittedAt) events.push({ at: c.submittedAt, icon: 'outbox', text: `Claim submitted to ${c.payerName}` });
      if (c.paidAt) events.push({ at: c.paidAt, icon: 'verified', text: `${c.payerName} paid the claim` });
    });
    if (inv.voidedAt) events.push({ at: inv.voidedAt, icon: 'block', text: `Voided — ${inv.voidReason}` });
    return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
    this.api.getFeeSchedules().subscribe(schedules => {
      this.feeLines.set((schedules.find(s => s.isDefault) ?? schedules[0])?.lines.slice() ?? []);
    });
  }

  // ── Draft editing ─────────────────────────────────────────────────────────

  protected addLine(): void {
    this.lines.push(lineGroup());
    this.lines.markAsDirty();
  }

  protected removeLine(i: number): void {
    this.lines.removeAt(i);
    this.lines.markAsDirty();
  }

  /** Fills description and price from the fee schedule when a known code is entered. */
  protected codeChanged(i: number): void {
    const group = this.lines.at(i);
    const fee = this.feeLines().find(l => l.cptCode === group.controls.serviceCode.value.trim().toUpperCase());
    if (fee) group.patchValue({ description: fee.description, unitPrice: fee.priceCents / 100 });
  }

  protected lineTotal(i: number): number {
    const v = this.lines.at(i).getRawValue();
    return centsFromDollars(v.unitPrice) * (v.quantity || 0);
  }

  protected readonly draftTotal = () =>
    this.lines.controls.reduce((sum, _, i) => sum + this.lineTotal(i), 0);

  protected saveDraft(): Observable<Invoice> {
    const inv = this.current;
    return this.api.updateDraft(inv.id, {
      lines: this.lines.getRawValue().map(l => ({
        serviceCode: l.serviceCode.trim().toUpperCase(),
        description: l.description.trim() || undefined,
        quantity: l.quantity,
        unitPriceCents: l.unitPrice === null ? undefined : centsFromDollars(l.unitPrice),
      })),
    });
  }

  protected save(): void {
    if (this.lines.invalid) {
      this.lines.markAllAsTouched();
      return;
    }
    this.run(this.saveDraft(), 'Draft saved.');
  }

  protected issue(): void {
    const save$ = this.lines.dirty ? this.saveDraft() : null;
    const issue$ = save$
      ? save$.pipe(switchMap(inv => this.api.issue(inv.id)))
      : this.api.issue(this.current.id);
    this.run(issue$, 'Invoice issued.');
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  protected takePayment(): void {
    const inv = this.current;
    const data: TakePaymentDialogData = { patientId: inv.patientId, patientName: inv.patientName, invoiceIds: [inv.id] };
    this.dialog.open(TakePaymentDialog, { data, width: '640px' }).afterClosed().pipe(filter(Boolean)).subscribe(() => {
      this.snack.open('Payment recorded.', undefined, { duration: 3000 });
      this.load(inv.id);
    });
  }

  protected adjust(): void {
    this.dialog.open(AdjustmentDialog, { data: this.invoice(), width: '520px' }).afterClosed()
      .pipe(filter((inv): inv is Invoice => !!inv))
      .subscribe(inv => {
        this.applyInvoice(inv);
        this.snack.open('Adjustment applied.', undefined, { duration: 3000 });
      });
  }

  protected fileClaim(): void {
    const inv = this.current;
    this.run(this.api.createClaim(inv.id).pipe(switchMap(() => this.api.findById(inv.id))), 'Claim created as draft. Submit it from the claims tracker.');
  }

  protected updateClaim(claimId: string): void {
    const claim = this.invoice()?.claims?.find(c => c.id === claimId);
    if (!claim) return;
    this.dialog.open(ClaimUpdateDialog, { data: claim, width: '520px' }).afterClosed().pipe(filter(Boolean)).subscribe(() => {
      this.snack.open('Claim updated.', undefined, { duration: 3000 });
      this.load(this.current.id);
    });
  }

  protected voidInvoice(): void {
    const data: ReasonDialogData = {
      title: `Void ${this.current.number}?`,
      message: 'Voided invoices stay on record but no longer count toward the balance.',
      confirmLabel: 'Void invoice',
    };
    this.dialog.open(ReasonDialog, { data, width: '440px' }).afterClosed()
      .pipe(filter((r): r is string => !!r))
      .subscribe(reason => this.run(this.api.void(this.current.id, reason), 'Invoice voided.'));
  }

  protected voidPayment(p: InvoicePayment): void {
    const data: ReasonDialogData = {
      title: 'Void this payment?',
      message: 'The amount returns to the invoice balance. Issue any refund through the payment processor.',
      confirmLabel: 'Void payment',
    };
    this.dialog.open(ReasonDialog, { data, width: '440px' }).afterClosed()
      .pipe(filter((r): r is string => !!r))
      .subscribe(reason => this.run(
        this.api.voidPayment(p.paymentId, reason).pipe(switchMap(() => this.api.findById(this.current.id))),
        'Payment voided.',
      ));
  }

  protected print(): void {
    window.print();
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  /** The loaded invoice; actions are only reachable once it has loaded. */
  private get current(): Invoice {
    const inv = this.invoice();
    if (!inv) throw new Error('Invoice not loaded');
    return inv;
  }

  private run(action$: Observable<Invoice | unknown>, message: string): void {
    this.busy.set(true);
    action$.subscribe({
      next: result => {
        this.busy.set(false);
        if (result && typeof result === 'object' && 'lines' in result) this.applyInvoice(result as Invoice);
        else this.load(this.current.id);
        this.snack.open(message, undefined, { duration: 3000 });
      },
      error: err => {
        this.busy.set(false);
        this.snack.open(errorMessage(err), 'Dismiss', { duration: 6000 });
      },
    });
  }

  private load(id: string): void {
    this.api.findById(id).subscribe({
      next: inv => this.applyInvoice(inv),
      error: err => this.loadError.set(errorMessage(err, 'This invoice could not be loaded.')),
    });
  }

  private applyInvoice(inv: Invoice): void {
    this.invoice.set(inv);
    this.lines.clear();
    inv.lines.forEach(l => this.lines.push(lineGroup(l)));
    this.lines.markAsPristine();
    if (inv.status === InvoiceStatus.Draft && this.perms.canManage()) this.lines.enable();
    else this.lines.disable();
  }
}
