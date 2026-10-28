import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { InsuranceClaim } from '@clinova/billing/domain';
import { CLAIM_TRANSITIONS, ClaimStatus } from '@clinova/billing/domain';
import { BillingApiService } from '@clinova/billing/data-access';
import { CentsPipe } from '../shared/cents.pipe';
import { centsFromDollars, errorMessage } from '../shared/billing-shared';

const LABELS: Record<ClaimStatus, string> = {
  [ClaimStatus.Draft]: 'Draft', [ClaimStatus.Submitted]: 'Submitted', [ClaimStatus.Pending]: 'Pending',
  [ClaimStatus.Paid]: 'Paid', [ClaimStatus.Denied]: 'Denied', [ClaimStatus.Appealed]: 'Appealed', [ClaimStatus.Voided]: 'Voided',
};

@Component({
  selector: 'clv-claim-update-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, CentsPipe],
  template: `
    <h2 mat-dialog-title>Update claim · {{ data.payerName }}</h2>
    <mat-dialog-content>
      <p class="meta">{{ data.invoiceNumber }} · {{ data.patientName }} · billed {{ data.billedCents | cents }} · currently <strong>{{ labels[data.status] }}</strong></p>
      <form [formGroup]="form" class="grid">
        <mat-form-field appearance="outline" class="span2">
          <mat-label>New status</mat-label>
          <mat-select formControlName="status">
            @for (s of next; track s) { <mat-option [value]="s">{{ labels[s] }}</mat-option> }
          </mat-select>
        </mat-form-field>
        @if (status() === 'PAID') {
          <mat-form-field appearance="outline">
            <mat-label>Amount paid by payer</mat-label>
            <span matTextPrefix>$&nbsp;</span>
            <input matInput type="number" formControlName="paid" min="0.01" step="0.01" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Contractual write-down</mat-label>
            <span matTextPrefix>$&nbsp;</span>
            <input matInput type="number" formControlName="contractual" min="0" step="0.01" />
            <mat-hint>From the remittance (EOB)</mat-hint>
          </mat-form-field>
        }
        @if (status() === 'DENIED') {
          <mat-form-field appearance="outline" class="span2">
            <mat-label>Denial reason</mat-label>
            <input matInput formControlName="denialReason" maxlength="1000" />
          </mat-form-field>
        }
        @if (status() === 'APPEALED') {
          <mat-form-field appearance="outline" class="span2">
            <mat-label>Appeal note</mat-label>
            <textarea matInput formControlName="appealNote" rows="3" maxlength="1000"></textarea>
          </mat-form-field>
        }
      </form>
      @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Cancel</button>
      <button mat-flat-button color="primary" type="button" [disabled]="busy() || !status()" (click)="submit()">Save</button>
    </mat-dialog-actions>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
    .span2 { grid-column: span 2; }
    .meta { margin: 0 0 16px; color: var(--clv-gray-700); font-size: 0.875rem; }
    .err { margin: 0; color: var(--clv-danger-text); }
  `,
})
export class ClaimUpdateDialog {
  protected readonly data = inject<InsuranceClaim>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ClaimUpdateDialog, InsuranceClaim>);
  private readonly api = inject(BillingApiService);

  protected readonly labels = LABELS;
  protected readonly next = CLAIM_TRANSITIONS[this.data.status];
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = new FormGroup({
    status: new FormControl<ClaimStatus | null>(this.next[0] ?? null),
    paid: new FormControl<number | null>(null),
    contractual: new FormControl<number | null>(null),
    denialReason: new FormControl('', { nonNullable: true }),
    appealNote: new FormControl('', { nonNullable: true }),
  });
  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly status = computed(() => this.value().status ?? null);

  protected submit(): void {
    const v = this.form.getRawValue();
    if (!v.status) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.updateClaim(this.data.id, {
      status: v.status,
      ...(v.status === ClaimStatus.Paid ? { paidAmountCents: centsFromDollars(v.paid), contractualAdjustmentCents: centsFromDollars(v.contractual) || undefined } : {}),
      ...(v.status === ClaimStatus.Denied ? { denialReason: v.denialReason } : {}),
      ...(v.status === ClaimStatus.Appealed ? { appealNote: v.appealNote } : {}),
    }).subscribe({
      next: claim => this.ref.close(claim),
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
