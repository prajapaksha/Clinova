import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'clv-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="login">
      <div class="login__card">

        <div class="login__brand">
          <span class="login__logo">C</span>
          <span class="login__brand-name">Clinova</span>
        </div>

        <h1 class="login__heading">Welcome back</h1>
        <p class="login__sub">Sign in to your staff account</p>

        @if (error()) {
          <div class="login__error">
            <mat-icon>error_outline</mat-icon>
            <span>{{ error() }}</span>
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" class="login__form">
          <mat-form-field appearance="outline" class="login__field">
            <mat-label>Email address</mat-label>
            <mat-icon matPrefix>mail_outline</mat-icon>
            <input matInput type="email" formControlName="email" autocomplete="email" />
            @if (form.controls.email.hasError('required') && form.controls.email.touched) {
              <mat-error>Email is required</mat-error>
            }
            @if (form.controls.email.hasError('email') && form.controls.email.touched) {
              <mat-error>Enter a valid email address</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="login__field">
            <mat-label>Password</mat-label>
            <mat-icon matPrefix>lock_outline</mat-icon>
            <input matInput [type]="showPassword() ? 'text' : 'password'"
                   formControlName="password" autocomplete="current-password" />
            <button mat-icon-button matSuffix type="button"
                    (click)="showPassword.set(!showPassword())"
                    [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
              <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            @if (form.controls.password.hasError('required') && form.controls.password.touched) {
              <mat-error>Password is required</mat-error>
            }
          </mat-form-field>

          <button mat-flat-button type="submit" class="login__submit"
                  [disabled]="loading() || form.invalid">
            @if (loading()) {
              <mat-spinner diameter="20" class="login__spinner" />
            } @else {
              Sign in
            }
          </button>
        </form>

        <p class="login__footer">Clinova Health Platform &copy; 2026</p>
      </div>
    </div>
  `,
  styles: [`
    .login {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #e8f5f3 0%, #f0f9ff 100%);
      padding: 24px;

      &__card {
        background: white;
        border-radius: 16px;
        padding: 40px 44px;
        width: 100%;
        max-width: 420px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.08);
      }

      &__brand {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 28px;
      }

      &__logo {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: var(--mat-sys-primary, #00796b);
        color: white;
        font-size: 1.25rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      &__brand-name {
        font-size: 1.375rem;
        font-weight: 700;
        color: var(--mat-sys-primary, #00796b);
        letter-spacing: -0.02em;
      }

      &__heading {
        font-size: 1.5rem;
        font-weight: 600;
        margin: 0 0 4px;
        color: #111827;
      }

      &__sub {
        font-size: 0.9rem;
        color: #6b7280;
        margin: 0 0 24px;
      }

      &__error {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background: rgba(220, 38, 38, 0.08);
        border: 1px solid rgba(220, 38, 38, 0.25);
        border-radius: 8px;
        color: #b91c1c;
        font-size: 0.875rem;
        margin-bottom: 20px;
        mat-icon { font-size: 1.1rem; width: 1.1rem; height: 1.1rem; flex-shrink: 0; }
      }

      &__form { display: flex; flex-direction: column; gap: 4px; }
      &__field { width: 100%; }

      &__submit {
        width: 100%;
        height: 48px;
        font-size: 1rem;
        margin-top: 8px;
        border-radius: 10px !important;
      }

      &__spinner { display: inline-block; }

      &__footer {
        text-align: center;
        font-size: 0.75rem;
        color: #9ca3af;
        margin: 28px 0 0;
      }
    }
  `],
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected readonly form = new FormGroup({
    email: new FormControl('', { validators: [Validators.required, Validators.email], nonNullable: true }),
    password: new FormControl('', { validators: [Validators.required], nonNullable: true }),
  });

  protected submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading.set(true);
    this.error.set(null);

    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigate(['/']),
      error: () => {
        this.error.set('Invalid email or password. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
