import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth';
import { Permissions, requirePermission } from './permissions';

function signInAs(role: string) {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const auth = TestBed.inject(AuthService);
  auth.login('x@clinova.test', 'pw').subscribe();
  TestBed.inject(HttpTestingController)
    .expectOne('/api/auth/login')
    .flush({ accessToken: 't', user: { id: 'u1', email: 'x@clinova.test', role, firstName: 'A', lastName: 'B' } });
  return TestBed.inject(Permissions);
}

describe('Permissions', () => {
  beforeEach(() => localStorage.clear());

  it('reflects the permission matrix for the signed-in role', () => {
    const perms = signInAs('STAFF');
    expect(perms.roleLabel()).toBe('Front desk');
    expect(perms.can('patient:profiles', 'write')).toBe(true);
    expect(perms.can('patient:profiles', 'full')).toBe(false);
    expect(perms.can('clinical:notes')).toBe(false);
    expect(perms.isProvider()).toBe(false);
  });

  it('identifies providers', () => {
    const perms = signInAs('PHYSICIAN');
    expect(perms.isProvider()).toBe(true);
    expect(perms.can('clinical:prescriptions', 'full')).toBe(true);
  });

  it('guards routes and redirects to the dashboard when not permitted', () => {
    signInAs('NURSE');
    const guard = requirePermission({ capability: 'billing:invoices', access: 'read' });
    const result = TestBed.runInInjectionContext(() => guard({} as never, {} as never));
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/dashboard');

    const allowed = requirePermission({ capability: 'scheduling:appointments', access: 'write' });
    expect(TestBed.runInInjectionContext(() => allowed({} as never, {} as never))).toBe(true);
  });
});
