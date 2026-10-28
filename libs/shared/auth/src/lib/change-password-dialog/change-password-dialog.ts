import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../auth/auth';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_AGE_DAYS } from '@clinova/identity/domain';

export interface ChangePasswordDialogData {
  /** The current password has expired (or is temporary): no cancel, offer sign-out instead. */
  required?: boolean;
}

const RULES: ReadonlyArray<{ label: string; test: (pw: string) => boolean }> = [
  { label: `At least ${PASSWORD_MIN_LENGTH} characters`, test: pw => pw.length >= PASSWORD_MIN_LENGTH },
  { label: 'An uppercase letter', test: pw => /[A-Z]/.test(pw) },
  { label: 'A lowercase letter', test: pw => /[a-z]/.test(pw) },
  { label: 'A number', test: pw => /\d/.test(pw) },
  { label: 'A symbol', test: pw => /[^A-Za-z0-9]/.test(pw) },
];

@Component({
  selector: 'clv-change-password-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ data.required ? 'Set a new password' : 'Change password' }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content class="cp">
        @if (data.required) {
          <p class="cp__intro">
            Your password is temporary or older than {{ maxAgeDays }} days. Choose a new one to continue.
          </p>
        }
        @if (error()) {
          <p class="cp__error" role="alert"><mat-icon>error_outline</mat-icon>{{ error() }}</p>
        }
        <mat-form-field appearance="outline">
          <mat-label>Current password</mat-label>
          <input matInput type="password" formControlName="currentPassword" autocomplete="current-password" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>New password</mat-label>
          <input matInput type="password" formControlName="newPassword" autocomplete="new-password" />
        </mat-form-field>
        <ul class="cp__rules" aria-label="Password requirements">
          @for (rule of rules(); track rule.label) {
            <li [class.cp__rule--ok]="rule.ok">
              <mat-icon>{{ rule.ok ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>{{ rule.label }}
            </li>
          }
        </ul>
        <mat-form-field appearance="outline">
          <mat-label>Confirm new password</mat-label>
          <input matInput type="password" formControlName="confirm" autocomplete="new-password" />
          @if (mismatch()) {
            <mat-hint class="cp__mismatch">Passwords don't match</mat-hint>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        @if (data.required) {
          <button mat-button type="button" (click)="signOut()">Sign out</button>
        } @else {
          <button mat-button type="button" mat-dialog-close>Cancel</button>
        }
        <button mat-flat-button color="primary" type="submit" [disabled]="!canSubmit()">
          {{ saving() ? 'Saving…' : 'Update password' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .cp { display: flex; flex-direction: column; min-width: min(420px, 80vw); }
    .cp__intro { margin: 0 0 16px; color: #475569; }
    .cp__error { display: flex; gap: 6px; align-items: center; color: #b91c1c; margin: 0 0 12px; }
    .cp__rules { list-style: none; padding: 0; margin: -8px 0 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: 0.8125rem; color: #64748b; }
    .cp__rules li { display: flex; align-items: center; gap: 4px; }
    .cp__rules mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .cp__rule--ok { color: #15803d; }
    .cp__mismatch { color: #b91c1c; }
  `,
})
export class ChangePasswordDialog {
  protected readonly data: ChangePasswordDialogData = inject(MAT_DIALOG_DATA, { optional: true }) ?? {};
  private readonly dialogRef = inject(MatDialogRef<ChangePasswordDialog>);
  private readonly auth = inject(AuthService);

  protected readonly maxAgeDays = PASSWORD_MAX_AGE_DAYS;
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    currentPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
    newPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
    confirm: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });
  private readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected readonly rules = computed(() => RULES.map(r => ({ label: r.label, ok: r.test(this.value().newPassword ?? '') })));
  protected readonly mismatch = computed(() => !!this.value().confirm && this.value().confirm !== this.value().newPassword);
  protected readonly canSubmit = computed(() =>
    !this.saving() && !!this.value().currentPassword && this.rules().every(r => r.ok) && this.value().confirm === this.value().newPassword);

  protected submit(): void {
    if (!this.canSubmit()) return;
    const { currentPassword, newPassword } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => this.dialogRef.close(true),
      error: (err: unknown) => {
        this.saving.set(false);
        const message = err instanceof HttpErrorResponse ? err.error?.message : null;
        this.error.set(typeof message === 'string' ? message : 'Could not update the password. Please try again.');
      },
    });
  }

  protected signOut(): void {
    this.dialogRef.close(false);
    this.auth.signOut();
  }
}
