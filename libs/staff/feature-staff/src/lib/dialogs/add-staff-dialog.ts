import { Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Permissions } from '@clinova/auth';
import { StaffApiService } from '@clinova/staff/data-access';
import type { StaffProfile } from '@clinova/staff/domain';
import { canManageAccount } from '@clinova/identity/domain';
import { ROLE_OPTIONS, errorMessage } from '../shared/staff-shared';
import { TemporaryPasswordDialog, TemporaryPasswordData } from './temporary-password-dialog';

@Component({
  selector: 'clv-add-staff-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>Add staff member</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="as">
        <mat-form-field appearance="outline" class="as__title"><mat-label>Title</mat-label><input matInput formControlName="title" placeholder="Dr." /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>First name</mat-label><input matInput formControlName="firstName" required /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Last name</mat-label><input matInput formControlName="lastName" required /></mat-form-field>
        <mat-form-field appearance="outline" class="as__wide"><mat-label>Work email</mat-label><input matInput type="email" formControlName="email" required /></mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Role</mat-label>
          <mat-select formControlName="role" required>
            @for (r of roles(); track r.value) { <mat-option [value]="r.value">{{ r.label }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Phone</mat-label><input matInput formControlName="phone" /></mat-form-field>
        @if (error()) { <p class="as__error as__wide" role="alert">{{ error() }}</p> }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="busy()">Create account</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .as { display: grid; grid-template-columns: 1fr 1fr; column-gap: 12px; max-width: 520px; }
    .as__wide { grid-column: 1 / -1; }
    .as__title { grid-column: 1 / -1; max-width: 120px; }
    .as__error { color: var(--clv-danger-text); margin: 0 0 8px; }
  `,
})
export class AddStaffDialog {
  private readonly api = inject(StaffApiService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<AddStaffDialog, StaffProfile>);
  private readonly perms = inject(Permissions);

  /** Practice admins can't create super admins. */
  protected readonly roles = computed(() => ROLE_OPTIONS.filter(r => canManageAccount(this.perms.role(), r.value, r.value)));
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    role: new FormControl('', { nonNullable: true, validators: Validators.required }),
    phone: new FormControl('', { nonNullable: true }),
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    this.api.create({ ...v, title: v.title || undefined, phone: v.phone || undefined }).subscribe({
      next: ({ profile, temporaryPassword }) => {
        this.dialogRef.close(profile);
        this.dialog.open<TemporaryPasswordDialog, TemporaryPasswordData>(TemporaryPasswordDialog, {
          data: { name: profile.displayName, email: profile.email, password: temporaryPassword, created: true },
        });
      },
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
