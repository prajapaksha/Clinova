import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService, StaffUser } from './auth';

const user: StaffUser = { id: 's1', email: 'doc@clinova.test', role: 'PHYSICIAN', firstName: 'Ada', lastName: 'Lee' };

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  return {
    service: TestBed.inject(AuthService),
    http: TestBed.inject(HttpTestingController),
    router: TestBed.inject(Router),
  };
}

describe('AuthService', () => {
  beforeEach(() => localStorage.clear());

  it('stores the token and user on login', () => {
    const { service, http } = setup();

    service.login(user.email, 'secret').subscribe();
    http.expectOne('/api/auth/login').flush({ accessToken: 'tkn', user });

    expect(service.getToken()).toBe('tkn');
    expect(service.currentUser()).toEqual(user);
    expect(service.isAuthenticated()).toBe(true);
    http.verify();
  });

  it('clears the session and navigates to login on logout', () => {
    const { service, http, router } = setup();
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    service.login(user.email, 'secret').subscribe();
    http.expectOne('/api/auth/login').flush({ accessToken: 'tkn', user });

    service.logout();

    expect(service.getToken()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('restores the user from an existing token', () => {
    localStorage.setItem('clv_access_token', 'tkn');
    const { service, http } = setup();

    let restored: StaffUser | null = null;
    service.restoreSession().subscribe(u => (restored = u));
    http.expectOne('/api/auth/me').flush(user);

    expect(restored).toEqual(user);
    expect(service.currentUser()).toEqual(user);
    http.verify();
  });

  it('does not call the API when there is no stored token', () => {
    const { service, http } = setup();

    service.restoreSession().subscribe();

    http.expectNone('/api/auth/me');
    expect(service.isAuthenticated()).toBe(false);
  });

  it('drops an invalid stored token without erroring', () => {
    localStorage.setItem('clv_access_token', 'bad');
    const { service, http } = setup();

    let restored: StaffUser | null | undefined;
    service.restoreSession().subscribe(u => (restored = u));
    http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(restored).toBeNull();
    expect(service.getToken()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('clears the expired-password flag after changing the password', () => {
    const { service, http } = setup();
    service.login(user.email, 'secret').subscribe();
    http.expectOne('/api/auth/login').flush({ accessToken: 'tkn', user: { ...user, passwordExpired: true } });
    expect(service.passwordExpired()).toBe(true);

    service.changePassword('old', 'New-Password-1').subscribe();
    const req = http.expectOne('/api/auth/change-password');
    expect(req.request.body).toEqual({ currentPassword: 'old', newPassword: 'New-Password-1' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(service.passwordExpired()).toBe(false);
  });

  it('records sign-out on the server before clearing the session', () => {
    const { service, http, router } = setup();
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    service.login(user.email, 'secret').subscribe();
    http.expectOne('/api/auth/login').flush({ accessToken: 'tkn', user });

    service.signOut('idle');
    expect(service.isAuthenticated()).toBe(true);
    http.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });

    expect(service.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], { queryParams: { reason: 'idle' } });
  });
});