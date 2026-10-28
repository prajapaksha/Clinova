import { Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { PortalSession } from '@clinova/portal/data-access';
import { AuthFrame } from './auth-frame';
import { PasswordRules, errorMessage, passwordOk } from '../shared/portal-shared';

@Component({
  selector: 'clv-forgot-password',
  imports: [ReactiveFormsModule, RouterModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, AuthFrame],
  template: `
    <clv-auth-frame title="Reset your password" subtitle="We'll email you a link to choose a new password.">
      @if (sent()) {
        <p class="pp-note" role="status"><mat-icon>mark_email_read</mat-icon>
          If an account exists for that email, a reset link is on its way. It expires in 60 minutes.</p>
        <a mat-stroked-button routerLink="/sign-in" class="fp__btn">Back to sign in</a>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="fp">
          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="email" />
          </mat-form-field>
          <button mat-flat-button color="primary" class="fp__btn" [disabled]="busy()">Send reset link</button>
          <a mat-button routerLink="/sign-in" class="fp__btn">Back to sign in</a>
        </form>
      }
    </clv-auth-frame>
  `,
  styles: `.fp { display: flex; flex-direction: column; gap: 6px; } .fp__btn { width: 100%; height: 46px; }`,
})
export class ForgotPasswordPage {
  private readonly session = inject(PortalSession);
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly form = new FormGroup({ email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }) });

  protected submit(): void {
    if (this.form.invalid) return;
    this.busy.set(true);
    this.session.forgotPassword(this.form.getRawValue().email).subscribe({
      next: () => this.sent.set(true),
      error: () => this.sent.set(true),
    });
  }
}

@Component({
  selector: 'clv-reset-password',
  imports: [ReactiveFormsModule, RouterModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, AuthFrame, PasswordRules],
  template: `
    <clv-auth-frame title="Choose a new password">
      @if (!token()) {
        <p class="pp-note pp-note--warn"><mat-icon>link_off</mat-icon>This reset link is incomplete. Request a new one.</p>
        <a mat-stroked-button routerLink="/forgot-password" class="rp__btn">Request a new link</a>
      } @else {
        @if (error()) { <p class="pp-note pp-note--warn" role="alert"><mat-icon>error_outline</mat-icon>{{ error() }}</p> }
        <form [formGroup]="form" (ngSubmit)="submit()" class="rp">
          <mat-form-field appearance="outline">
            <mat-label>New password</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="new-password" />
          </mat-form-field>
          <clv-password-rules [password]="value().password ?? ''" />
          <mat-form-field appearance="outline">
            <mat-label>Confirm new password</mat-label>
            <input matInput type="password" formControlName="confirm" autocomplete="new-password" />
          </mat-form-field>
          <button mat-flat-button color="primary" class="rp__btn" [disabled]="!canSubmit()">Save and sign in</button>
        </form>
      }
    </clv-auth-frame>
  `,
  styles: `.rp { display: flex; flex-direction: column; } .rp__btn { width: 100%; height: 46px; } .pp-note { margin: 0 0 14px; }`,
})
export class ResetPasswordPage {
  private readonly session = inject(PortalSession);
  private readonly router = inject(Router);
  readonly token = input<string>();

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = new FormGroup({
    password: new FormControl('', { nonNullable: true }),
    confirm: new FormControl('', { nonNullable: true }),
  });
  protected readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly canSubmit = computed(() => !this.busy() && passwordOk(this.value().password ?? '') && this.value().password === this.value().confirm);

  protected submit(): void {
    if (!this.canSubmit()) return;
    this.busy.set(true);
    this.session.resetPassword(this.token() as string, this.form.getRawValue().password).subscribe({
      next: () => this.router.navigate(['/']),
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
