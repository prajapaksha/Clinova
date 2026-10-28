import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type { Invoice } from '@clinova/billing/domain';
import { AdjustmentType } from '@clinova/billing/domain';
import { BillingApiService } from '@clinova/billing/data-access';
import { CentsPipe } from '../shared/cents.pipe';
import { centsFromDollars, errorMessage } from '../shared/billing-shared';

const TYPE_LABELS: Record<AdjustmentType, string> = {
  [AdjustmentType.CourtesyDiscount]: 'Courtesy discount',
  [AdjustmentType.InsuranceContractual]: 'Insurance contractual',
  [AdjustmentType.Writeoff]: 'Write-off',
  [AdjustmentType.BadDebt]: 'Bad debt',
  [AdjustmentType.Other]: 'Other',
};

/** Applies a write-off / discount to an open invoice; closes with the updated Invoice. */
@Component({
  selector: 'clv-adjustment-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, CentsPipe],
  template: `
    <h2 mat-dialog-title>Apply adjustment · {{ data.number }}</h2>
    <mat-dialog-content>
      <p class="msg">Remaining balance: <strong>{{ data.balanceCents | cents }}</strong></p>
      <form [formGroup]="form" class="grid">
        <mat-form-field appearance="outline">
          <mat-label>Type</mat-label>
          <mat-select formControlName="type">
            @for (t of types; track t) { <mat-option [value]="t">{{ labels[t] }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Amount</mat-label>
          <span matTextPrefix>$&nbsp;</span>
          <input matInput type="number" formControlName="amount" min="0.01" step="0.01" />
        </mat-form-field>
        <mat-form-field appearance="outline" class="span2">
          <mat-label>Reason</mat-label>
          <input matInput formControlName="reason" maxlength="500" />
        </mat-form-field>
      </form>
      @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Cancel</button>
      <button mat-flat-button color="primary" type="button" [disabled]="busy()" (click)="submit()">Apply</button>
    </mat-dialog-actions>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
    .span2 { grid-column: span 2; }
    .msg { margin: 0 0 12px; }
    .err { color: var(--clv-danger-text); margin: 0; }
  `,
})
export class AdjustmentDialog {
  protected readonly data = inject<Invoice>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<AdjustmentDialog, Invoice>);
  private readonly api = inject(BillingApiService);

  protected readonly types = Object.values(AdjustmentType);
  protected readonly labels = TYPE_LABELS;
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = new FormGroup({
    type: new FormControl(AdjustmentType.CourtesyDiscount, { nonNullable: true }),
    amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    reason: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.api.applyAdjustment(this.data.id, { type: v.type, amountCents: centsFromDollars(v.amount), reason: v.reason.trim() }).subscribe({
      next: inv => this.ref.close(inv),
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
