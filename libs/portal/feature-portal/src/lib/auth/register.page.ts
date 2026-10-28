import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { PortalSession } from '@clinova/portal/data-access';
import type { PortalUser } from '@clinova/portal/domain';
import { AuthFrame } from './auth-frame';
import { PasswordRules, errorMessage, passwordOk } from '../shared/portal-shared';

type Mode = 'code' | 'match';

/** Account creation: an invite code from the office, or matching an existing record (PRD §11.3 decision). */
@Component({
  selector: 'clv-register',
  imports: [ReactiveFormsModule, RouterModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, AuthFrame, PasswordRules],
  template: `
    <clv-auth-frame title="Create your account" subtitle="For patients of the practice.">
      <div class="pp-tabs" role="tablist">
        <button type="button" role="tab" [class.is-active]="mode() === 'code'" [attr.aria-selected]="mode() === 'code'" (click)="mode.set('code')">I have an invite code</button>
        <button type="button" role="tab" [class.is-active]="mode() === 'match'" [attr.aria-selected]="mode() === 'match'" (click)="mode.set('match')">Find my record</button>
      </div>
      <p class="pp-muted rg__hint">
        @if (mode() === 'code') { Enter the email address and 8-character code the office gave you. }
        @else { We'll match your details to your record. Use the email address the office has on file. }
      </p>
      @if (error()) { <p class="pp-note pp-note--warn" role="alert"><mat-icon>error_outline</mat-icon>{{ error() }}</p> }
      <form [formGroup]="form" (ngSubmit)="submit()" class="rg">
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="email" />
        </mat-form-field>
        @if (mode() === 'code') {
          <mat-form-field appearance="outline">
            <mat-label>Invite code</mat-label>
            <input matInput formControlName="code" autocomplete="one-time-code" placeholder="ABCD-2345" />
          </mat-form-field>
        } @else {
          <mat-form-field appearance="outline">
            <mat-label>Last name</mat-label>
            <input matInput formControlName="lastName" autocomplete="family-name" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Date of birth</mat-label>
            <input matInput type="date" formControlName="dateOfBirth" autocomplete="bday" />
          </mat-form-field>
        }
        <mat-form-field appearance="outline">
          <mat-label>Create a password</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="new-password" />
        </mat-form-field>
        <clv-password-rules [password]="value().password ?? ''" />
        <mat-form-field appearance="outline">
          <mat-label>Confirm password</mat-label>
          <input matInput type="password" formControlName="confirm" autocomplete="new-password" />
          @if (mismatch()) { <mat-hint class="pp-error">Passwords don't match</mat-hint> }
        </mat-form-field>
        <button mat-flat-button color="primary" class="rg__submit" [disabled]="busy()">{{ busy() ? 'Creating account…' : 'Create account' }}</button>
      </form>
      <p class="rg__foot">Already have an account? <a routerLink="/sign-in">Sign in</a></p>
    </clv-auth-frame>
  `,
  styles: `
    .rg { display: flex; flex-direction: column; }
    .rg__hint { margin: -6px 0 16px; font-size: 14px; }
    .rg__submit { height: 46px; margin-top: 4px; }
    .rg__foot { text-align: center; margin: 18px 0 0; color: var(--clv-gray-600); }
    .pp-tabs button { flex: 1; font-size: 14px; }
    .pp-note { margin: 0 0 14px; }
  `,
})
export class RegisterPage implements OnInit {
  private readonly session = inject(PortalSession);
  private readonly router = inject(Router);

  /** Query params from an invite link. */
  readonly code = input<string>();
  readonly email = input<string>();

  protected readonly mode = signal<Mode>('code');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    code: new FormControl('', { nonNullable: true }),
    lastName: new FormControl('', { nonNullable: true }),
    dateOfBirth: new FormControl('', { nonNullable: true }),
    password: new FormControl('', { nonNullable: true, validators: Validators.required }),
    confirm: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });
  protected readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly mismatch = computed(() => !!this.value().confirm && this.value().confirm !== this.value().password);

  ngOnInit(): void {
    if (this.code()) this.form.patchValue({ code: this.code() });
    if (this.email()) this.form.patchValue({ email: this.email() });
  }

  protected submit(): void {
    const v = this.form.getRawValue();
    const missing = this.mode() === 'code' ? !v.code.trim() : !v.lastName.trim() || !v.dateOfBirth;
    if (this.form.invalid || missing) {
      this.form.markAllAsTouched();
      this.error.set('Please fill in all fields.');
      return;
    }
    if (!passwordOk(v.password)) {
      this.error.set('Your password does not meet the requirements yet.');
      return;
    }
    if (v.password !== v.confirm) {
      this.error.set("Passwords don't match.");
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    const request: Observable<PortalUser> = this.mode() === 'code'
      ? this.session.activate({ email: v.email, code: v.code, password: v.password })
      : this.session.register({ email: v.email, lastName: v.lastName, dateOfBirth: v.dateOfBirth, password: v.password });
    request.subscribe({
      next: () => this.router.navigate(['/'], { queryParams: { welcome: 1 } }),
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
