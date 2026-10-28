import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@clinova/identity/domain';
import { PermissionsGuard } from './permissions.guard';
import { full, Permit, read, write } from '../decorators/permit.decorator';
import { Public } from '../decorators/public.decorator';

class TestController {
  open() { return 'open'; }
  @Permit(read('clinical:notes')) readNotes() { return 'notes'; }
  @Permit(full('clinical:prescriptions')) prescribe() { return 'rx'; }
  @Permit(full('clinical:notes'), write('system:settings')) createTemplate() { return 'template'; }
  @Public() health() { return 'ok'; }
}

@Permit(full('billing:invoices'))
class BillingTestController {
  summary() { return 'summary'; }
  @Permit(read('billing:invoices')) list() { return 'list'; }
}

function context(cls: object, handler: keyof TestController | keyof BillingTestController, role?: string): ExecutionContext {
  const proto = (cls as { prototype: Record<string, unknown> }).prototype;
  return {
    getHandler: () => proto[handler],
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { id: 'u1', role } : undefined }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());
  const allows = (cls: object, handler: Parameters<typeof context>[1], role?: string) => {
    try {
      return guard.canActivate(context(cls, handler, role));
    } catch (e) {
      if (e instanceof ForbiddenException) return false;
      throw e;
    }
  };

  it('lets any staff role through routes without @Permit, but not patients', () => {
    for (const role of [UserRole.SuperAdmin, UserRole.Admin, UserRole.Doctor, UserRole.Nurse, UserRole.FrontDesk, UserRole.BillingSpecialist]) {
      expect(allows(TestController, 'open', role)).toBe(true);
    }
    expect(allows(TestController, 'open', UserRole.Patient)).toBe(false);
    expect(allows(TestController, 'open')).toBe(false);
  });

  it('skips authorization for @Public routes', () => {
    expect(allows(TestController, 'health')).toBe(true);
  });

  it('applies the permission matrix to @Permit rules', () => {
    expect(allows(TestController, 'readNotes', UserRole.Admin)).toBe(true);
    expect(allows(TestController, 'readNotes', UserRole.Nurse)).toBe(true);
    expect(allows(TestController, 'readNotes', UserRole.FrontDesk)).toBe(false);
    expect(allows(TestController, 'readNotes', UserRole.BillingSpecialist)).toBe(false);

    expect(allows(TestController, 'prescribe', UserRole.Doctor)).toBe(true);
    expect(allows(TestController, 'prescribe', UserRole.Nurse)).toBe(false);
    expect(allows(TestController, 'prescribe', UserRole.Admin)).toBe(false);
  });

  it('accepts any of several rules', () => {
    expect(allows(TestController, 'createTemplate', UserRole.Doctor)).toBe(true);
    expect(allows(TestController, 'createTemplate', UserRole.Admin)).toBe(true);
    expect(allows(TestController, 'createTemplate', UserRole.Nurse)).toBe(false);
  });

  it('lets method rules override class rules', () => {
    expect(allows(BillingTestController, 'summary', UserRole.BillingSpecialist)).toBe(true);
    expect(allows(BillingTestController, 'summary', UserRole.Doctor)).toBe(false);
    expect(allows(BillingTestController, 'list', UserRole.Doctor)).toBe(true);
    expect(allows(BillingTestController, 'list', UserRole.Nurse)).toBe(false);
  });
});
