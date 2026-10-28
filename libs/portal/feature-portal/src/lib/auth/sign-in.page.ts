import { Component, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { PortalSession } from '@clinova/portal/data-access';
import { PATIENT_IDLE_TIMEOUT_MINUTES } from '@clinova/portal/domain';
import { AuthFrame } from './auth-frame';
import { errorMessage } from '../shared/portal-shared';

@Component({
  selector: 'clv-sign-in',
  imports: [ReactiveFormsModule, RouterModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, AuthFrame],
  template: `
    <clv-auth-frame title="Welcome back" subtitle="Sign in to your patient portal.">
      @if (notice()) { <p class="pp-note" role="status"><mat-icon>info</mat-icon>{{ notice() }}</p> }
      @if (error()) { <p class="pp-note pp-note--warn" role="alert"><mat-icon>error_outline</mat-icon>{{ error() }}</p> }
      <form [formGroup]="form" (ngSubmit)="submit()" class="si">
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="email" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Password</mat-label>
          <input matInput [type]="show() ? 'text' : 'password'" formControlName="password" autocomplete="current-password" />
          <button mat-icon-button matSuffix type="button" (click)="show.set(!show())" [attr.aria-label]="show() ? 'Hide password' : 'Show password'">
            <mat-icon>{{ show() ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
        </mat-form-field>
        <a routerLink="/forgot-password" class="si__forgot">Forgot password?</a>
        <button mat-flat-button color="primary" class="si__submit" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Sign in' }}</button>
      </form>
      <div class="si__divider"><span>New to the portal?</span></div>
      <a mat-stroked-button routerLink="/register" class="si__submit">Create your account</a>
    </clv-auth-frame>
  `,
  styles: `
    .si { display: flex; flex-direction: column; margin-top: 8px; }
    .si__forgot { align-self: flex-end; margin: -8px 0 16px; font-size: 14px; color: var(--clv-primary-700); }
    .si__submit { width: 100%; height: 46px; }
    .si__divider { display: flex; align-items: center; gap: 12px; margin: 22px 0 14px; color: var(--clv-gray-600); font-size: 14px; }
    .si__divider::before, .si__divider::after { content: ''; flex: 1; height: 1px; background: var(--clv-gray-200); }
    .pp-note { margin: 0 0 14px; }
  `,
})
export class SignInPage {
  private readonly session = inject(PortalSession);
  private readonly router = inject(Router);

  readonly reason = input<string>();
  readonly returnUrl = input<string>();

  protected readonly show = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected notice(): string | null {
    if (this.reason() === 'idle') return `For your privacy you were signed out after ${PATIENT_IDLE_TIMEOUT_MINUTES} minutes of inactivity.`;
    if (this.reason() === 'expired') return 'Your session has ended. Please sign in again.';
    return null;
  }

  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: Validators.required }),
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    this.session.login(email, password).subscribe({
      next: () => this.router.navigateByUrl(this.returnUrl()?.startsWith('/') ? this.returnUrl() as string : '/'),
      error: err => {
        this.busy.set(false);
        this.error.set(errorMessage(err, 'Incorrect email or password.'));
      },
    });
  }
}
