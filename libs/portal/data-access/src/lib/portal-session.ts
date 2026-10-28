import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, tap } from 'rxjs';
import type { PortalUser } from '@clinova/portal/domain';

const TOKEN_KEY = 'clv_portal_token';

interface SessionResponse {
  accessToken: string;
  user: PortalUser;
}

/** Patient portal session (separate token from the staff app). */
@Injectable({ providedIn: 'root' })
export class PortalSession {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _user = signal<PortalUser | null>(null);
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  /** Shown once after sign-in ("Last signed in …"). */
  readonly previousLogin = signal<Date | null>(null);

  restore(): Observable<PortalUser | null> {
    if (!this.token()) return of(null);
    return this.http.get<PortalUser>('/api/portal/auth/me').pipe(
      tap(u => this._user.set(u)),
      map(u => u as PortalUser | null),
      catchError(() => {
        this.clear();
        return of(null);
      }),
    );
  }

  login(email: string, password: string): Observable<PortalUser> {
    return this.start(this.http.post<SessionResponse>('/api/portal/auth/login', { email, password }));
  }

  register(dto: { lastName: string; dateOfBirth: string; email: string; password: string }): Observable<PortalUser> {
    return this.start(this.http.post<SessionResponse>('/api/portal/auth/register', dto));
  }

  activate(dto: { email: string; code: string; password: string }): Observable<PortalUser> {
    return this.start(this.http.post<SessionResponse>('/api/portal/auth/activate', dto));
  }

  forgotPassword(email: string): Observable<void> {
    return this.http.post<void>('/api/portal/auth/forgot-password', { email });
  }

  resetPassword(token: string, password: string): Observable<PortalUser> {
    return this.start(this.http.post<SessionResponse>('/api/portal/auth/reset-password', { token, password }));
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>('/api/portal/auth/change-password', { currentPassword, newPassword });
  }

  signOut(reason?: 'idle'): void {
    if (!this.token()) {
      this.end(reason);
      return;
    }
    this.http.post<void>('/api/portal/auth/logout', {}).pipe(
      catchError(() => of(undefined)),
      finalize(() => this.end(reason)),
    ).subscribe();
  }

  /** Clears the session locally (e.g. after a 401). */
  end(reason?: 'idle' | 'expired'): void {
    this.clear();
    if (reason) this.router.navigate(['/sign-in'], { queryParams: { reason } });
    else this.router.navigate(['/sign-in']);
  }

  token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private start(request: Observable<SessionResponse>): Observable<PortalUser> {
    return request.pipe(
      tap(({ accessToken, user }) => {
        localStorage.setItem(TOKEN_KEY, accessToken);
        this._user.set(user);
        this.previousLogin.set(user.lastLoginAt ? new Date(user.lastLoginAt) : null);
      }),
      map(({ user }) => user),
    );
  }

  private clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    this._user.set(null);
  }
}
