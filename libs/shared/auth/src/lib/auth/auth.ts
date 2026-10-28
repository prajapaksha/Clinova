import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, tap } from 'rxjs';

export interface StaffUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  /** Password older than the 90-day policy, or a temporary password set by an admin. */
  passwordExpired?: boolean;
  lastLoginAt?: string | null;
  mfaEnabled?: boolean;
}

const TOKEN_KEY = 'clv_access_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _user = signal<StaffUser | null>(null);
  readonly currentUser = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly passwordExpired = computed(() => !!this._user()?.passwordExpired);

  // Call from an app initializer, not the constructor: the HTTP interceptor injects
  // AuthService, so a request during construction hits a circular-DI error.
  restoreSession(): Observable<StaffUser | null> {
    if (!this.getToken()) return of(null);
    return this.http.get<StaffUser>('/api/auth/me').pipe(
      tap(user => this._user.set(user)),
      map(user => user as StaffUser | null),
      catchError(() => {
        this.clearSession();
        return of(null);
      }),
    );
  }

  login(email: string, password: string) {
    return this.http.post<{ accessToken: string; user: StaffUser }>('/api/auth/login', { email, password }).pipe(
      tap(({ accessToken, user }) => {
        localStorage.setItem(TOKEN_KEY, accessToken);
        this._user.set(user);
      }),
    );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>('/api/auth/change-password', { currentPassword, newPassword }).pipe(
      tap(() => this._user.update(u => (u ? { ...u, passwordExpired: false } : u))),
    );
  }

  /** User-initiated sign-out: records it in the audit log, then clears the session. */
  signOut(reason?: 'idle'): void {
    if (!this.getToken()) {
      this.logout(reason);
      return;
    }
    this.http.post<void>('/api/auth/logout', {}).pipe(
      catchError(() => of(undefined)),
      finalize(() => this.logout(reason)),
    ).subscribe();
  }

  /** Clears the local session without calling the API (e.g. after a 401). */
  logout(reason?: 'idle'): void {
    this.clearSession();
    if (reason) this.router.navigate(['/auth/login'], { queryParams: { reason } });
    else this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    this._user.set(null);
  }
}
