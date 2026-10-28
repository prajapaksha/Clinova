import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { StaffApiService } from '@clinova/staff/data-access';
import type { StaffCredential } from '@clinova/staff/domain';
import { CREDENTIAL_TYPE_LABELS, CredentialType } from '@clinova/staff/domain';
import { errorMessage } from '../shared/staff-shared';

export interface CredentialDialogData {
  staffId: string;
  credential?: StaffCredential;
  /** Only managers can mark a credential as verified. */
  canVerify: boolean;
}

const dateOnly = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : '');

@Component({
  selector: 'clv-credential-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ data.credential ? 'Edit credential' : 'Add credential' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="cd">
        <mat-form-field appearance="outline">
          <mat-label>Type</mat-label>
          <mat-select formControlName="type" required>
            @for (t of types; track t.value) { <mat-option [value]="t.value">{{ t.label }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Number</mat-label><input matInput formControlName="number" required /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Issuing state</mat-label><input matInput formControlName="issuingState" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Issuing authority</mat-label><input matInput formControlName="issuingAuthority" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Issue date</mat-label><input matInput type="date" formControlName="issueDate" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Expiration date</mat-label><input matInput type="date" formControlName="expirationDate" /></mat-form-field>
        @if (data.canVerify) {
          <mat-checkbox formControlName="isVerified" class="cd__wide">Verified against the primary source</mat-checkbox>
        }
        @if (error()) { <p class="cd__error cd__wide" role="alert">{{ error() }}</p> }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="busy()">Save</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .cd { display: grid; grid-template-columns: 1fr 1fr; column-gap: 12px; max-width: 520px; }
    .cd__wide { grid-column: 1 / -1; }
    .cd__error { color: var(--clv-danger-text); margin: 8px 0 0; }
  `,
})
export class CredentialDialog {
  protected readonly data = inject<CredentialDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(StaffApiService);
  private readonly dialogRef = inject(MatDialogRef<CredentialDialog, StaffCredential>);

  protected readonly types = Object.values(CredentialType).map(value => ({ value, label: CREDENTIAL_TYPE_LABELS[value] }));
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly c = this.data.credential;
  protected readonly form = new FormGroup({
    type: new FormControl<CredentialType>(this.c?.type ?? CredentialType.MedicalLicense, { nonNullable: true, validators: Validators.required }),
    number: new FormControl(this.c?.number ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(60)] }),
    issuingState: new FormControl(this.c?.issuingState ?? '', { nonNullable: true }),
    issuingAuthority: new FormControl(this.c?.issuingAuthority ?? '', { nonNullable: true }),
    issueDate: new FormControl(dateOnly(this.c?.issueDate), { nonNullable: true }),
    expirationDate: new FormControl(dateOnly(this.c?.expirationDate), { nonNullable: true }),
    isVerified: new FormControl(this.c?.isVerified ?? false, { nonNullable: true }),
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const input = {
      ...v,
      issuingState: v.issuingState || null,
      issuingAuthority: v.issuingAuthority || null,
      issueDate: v.issueDate || null,
      expirationDate: v.expirationDate || null,
      isVerified: this.data.canVerify ? v.isVerified : this.c?.isVerified ?? false,
    };
    this.busy.set(true);
    this.error.set(null);
    const request = this.c
      ? this.api.updateCredential(this.data.staffId, this.c.id, input)
      : this.api.addCredential(this.data.staffId, input);
    request.subscribe({
      next: credential => this.dialogRef.close(credential),
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
