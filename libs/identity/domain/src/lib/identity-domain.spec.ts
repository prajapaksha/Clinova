import {
  PERMISSION_MATRIX,
  PermissionLevel,
  UserRole,
  canManageAccount,
  hasAccess,
  isPasswordExpired,
  isProviderRole,
  passwordPolicyErrors,
  permissionLevel,
  satisfiesAny,
} from './identity-domain';

describe('identity domain', () => {
  describe('permission matrix (PRD §3.2)', () => {
    it('defines every capability for every role', () => {
      const capabilities = Object.keys(PERMISSION_MATRIX[UserRole.SuperAdmin]).sort();
      for (const role of Object.values(UserRole)) {
        expect(Object.keys(PERMISSION_MATRIX[role]).sort()).toEqual(capabilities);
      }
    });

    it.each([
      [UserRole.Admin, 'clinical:notes', PermissionLevel.ReadOnly],
      [UserRole.Doctor, 'billing:invoices', PermissionLevel.ReadOnly],
      [UserRole.Nurse, 'clinical:notes', PermissionLevel.Limited],
      [UserRole.FrontDesk, 'patient:profiles', PermissionLevel.Limited],
      [UserRole.BillingSpecialist, 'scheduling:appointments', PermissionLevel.ReadOnly],
      [UserRole.Admin, 'identity:auditLogs', PermissionLevel.ReadOnly],
    ] as const)('%s has %s = %s', (role, capability, level) => {
      expect(permissionLevel(role, capability)).toBe(level);
    });

    it('treats unknown roles as having no access', () => {
      expect(permissionLevel('JANITOR', 'patient:profiles')).toBe(PermissionLevel.None);
      expect(hasAccess(undefined, 'patient:profiles', 'read')).toBe(false);
    });
  });

  describe('hasAccess', () => {
    it('maps read / write / full to permission levels', () => {
      expect(hasAccess(UserRole.Admin, 'clinical:notes', 'read')).toBe(true);
      expect(hasAccess(UserRole.Admin, 'clinical:notes', 'write')).toBe(false);
      expect(hasAccess(UserRole.Nurse, 'clinical:notes', 'write')).toBe(true);
      expect(hasAccess(UserRole.Nurse, 'clinical:notes', 'full')).toBe(false);
      expect(hasAccess(UserRole.FrontDesk, 'billing:invoices', 'write')).toBe(true);
      expect(hasAccess(UserRole.Nurse, 'billing:invoices', 'read')).toBe(false);
    });

    it('satisfiesAny passes when one rule matches', () => {
      const rules = [{ capability: 'clinical:notes', access: 'full' }, { capability: 'system:settings', access: 'write' }] as const;
      expect(satisfiesAny(UserRole.Admin, rules)).toBe(true);
      expect(satisfiesAny(UserRole.Nurse, rules)).toBe(false);
    });
  });

  describe('canManageAccount', () => {
    it('lets super admins manage anyone', () => {
      expect(canManageAccount(UserRole.SuperAdmin, UserRole.SuperAdmin, UserRole.Admin)).toBe(true);
    });

    it('limits practice admins to non-super-admin accounts', () => {
      expect(canManageAccount(UserRole.Admin, UserRole.Nurse, UserRole.FrontDesk)).toBe(true);
      expect(canManageAccount(UserRole.Admin, UserRole.SuperAdmin)).toBe(false);
      expect(canManageAccount(UserRole.Admin, UserRole.Nurse, UserRole.SuperAdmin)).toBe(false);
    });

    it('denies everyone else', () => {
      expect(canManageAccount(UserRole.Doctor, UserRole.Nurse)).toBe(false);
    });
  });

  describe('password policy', () => {
    it('lists unmet rules', () => {
      expect(passwordPolicyErrors('short')).toEqual([
        'At least 12 characters', 'An uppercase letter', 'A number', 'A symbol',
      ]);
      expect(passwordPolicyErrors('Correct-Horse-9')).toEqual([]);
    });

    it('expires passwords after 90 days', () => {
      const now = new Date('2026-10-28T00:00:00Z');
      expect(isPasswordExpired(new Date('2026-08-01T00:00:00Z'), now)).toBe(false);
      expect(isPasswordExpired(new Date('2026-07-01T00:00:00Z'), now)).toBe(true);
    });
  });

  it('only physicians are providers', () => {
    expect(isProviderRole(UserRole.Doctor)).toBe(true);
    expect(isProviderRole(UserRole.SuperAdmin)).toBe(false);
  });
});
