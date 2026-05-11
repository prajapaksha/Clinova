import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';

export interface StaffUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

const TOKEN_KEY = 'clv_access_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _user = signal<StaffUser | null>(null);
  readonly currentUser = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  constructor() {
    if (this.getToken()) {
      this.http.get<StaffUser>('/api/auth/me').subscribe({
        next: user => this._user.set(user),
        error: () => this.clearSession(),
      });
    }
  }

  login(email: string, password: string) {
    return this.http.post<{ accessToken: string; user: StaffUser }>('/api/auth/login', { email, password }).pipe(
      tap(({ accessToken, user }) => {
        localStorage.setItem(TOKEN_KEY, accessToken);
        this._user.set(user);
      }),
    );
  }

  logout(): void {
    this.clearSession();
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    this._user.set(null);
  }
}
