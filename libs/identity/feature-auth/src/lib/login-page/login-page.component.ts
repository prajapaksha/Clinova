import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { STAFF_IDLE_TIMEOUT_MINUTES } from '@clinova/identity/domain';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '@clinova/auth';

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
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly notice = inject(ActivatedRoute).snapshot.queryParamMap.get('reason') === 'idle'
    ? `For your security you were signed out after ${STAFF_IDLE_TIMEOUT_MINUTES} minutes of inactivity.`
    : null;

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
      error: (err: unknown) => {
        const message = err instanceof HttpErrorResponse ? err.error?.message : null;
        // Lockout messages are specific; anything else stays generic to avoid account enumeration.
        this.error.set(typeof message === 'string' && message.startsWith('Account locked') ? message : 'Invalid email or password. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
