// ── Branded IDs ───────────────────────────────────────────────────────────────
export type UserId = string & { readonly _brand: 'UserId' };

// ── Roles ─────────────────────────────────────────────────────────────────────
/** Values match what is stored on Staff.role and carried in JWTs. */
export enum UserRole {
  SuperAdmin = 'SUPER_ADMIN',
  Admin = 'ADMIN',
  Doctor = 'PHYSICIAN',
  Nurse = 'NURSE',
  FrontDesk = 'STAFF',
  BillingSpecialist = 'BILLING',
  Patient = 'PATIENT',
}

export const STAFF_ROLES: ReadonlyArray<UserRole> = [
  UserRole.SuperAdmin,
  UserRole.Admin,
  UserRole.Doctor,
  UserRole.Nurse,
  UserRole.FrontDesk,
  UserRole.BillingSpecialist,
];

export const ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  [UserRole.SuperAdmin]: 'Super admin',
  [UserRole.Admin]: 'Practice admin',
  [UserRole.Doctor]: 'Physician',
  [UserRole.Nurse]: 'Nurse / MA',
  [UserRole.FrontDesk]: 'Front desk',
  [UserRole.BillingSpecialist]: 'Billing specialist',
  [UserRole.Patient]: 'Patient',
};

/** Roles that can own encounters, sign notes, and prescribe. */
export const PROVIDER_ROLES: ReadonlyArray<UserRole> = [UserRole.Doctor];

export function isProviderRole(role: string | null | undefined): boolean {
  return PROVIDER_ROLES.includes(role as UserRole);
}

// ── Permissions (PRD §3.2) ────────────────────────────────────────────────────
export enum PermissionLevel {
  Full = 'FULL',
  ReadOnly = 'READ_ONLY',
  Limited = 'LIMITED',
  None = 'NONE',
}

export type CapabilityKey =
  | 'patient:profiles'
  | 'clinical:notes'
  | 'scheduling:appointments'
  | 'clinical:prescriptions'
  | 'billing:invoices'
  | 'staff:profiles'
  | 'reporting:reports'
  | 'system:settings'
  | 'identity:users'
  | 'identity:auditLogs';

const F = PermissionLevel.Full;
const R = PermissionLevel.ReadOnly;
const L = PermissionLevel.Limited;
const N = PermissionLevel.None;

/**
 * The permissions matrix from PRD §3.2 (F = full, R = read-only, L = limited subset,
 * — = none). Single source of truth for the API guards and the staff app.
 */
export const PERMISSION_MATRIX: Readonly<Record<UserRole, Readonly<Record<CapabilityKey, PermissionLevel>>>> = {
  [UserRole.SuperAdmin]: {
    'patient:profiles': F, 'clinical:notes': F, 'scheduling:appointments': F, 'clinical:prescriptions': F,
    'billing:invoices': F, 'staff:profiles': F, 'reporting:reports': F, 'system:settings': F,
    'identity:users': F, 'identity:auditLogs': F,
  },
  [UserRole.Admin]: {
    'patient:profiles': F, 'clinical:notes': R, 'scheduling:appointments': F, 'clinical:prescriptions': R,
    'billing:invoices': F, 'staff:profiles': F, 'reporting:reports': F, 'system:settings': L,
    'identity:users': L, 'identity:auditLogs': R,
  },
  [UserRole.Doctor]: {
    'patient:profiles': F, 'clinical:notes': F, 'scheduling:appointments': F, 'clinical:prescriptions': F,
    'billing:invoices': R, 'staff:profiles': L, 'reporting:reports': L, 'system:settings': N,
    'identity:users': N, 'identity:auditLogs': N,
  },
  [UserRole.Nurse]: {
    'patient:profiles': R, 'clinical:notes': L, 'scheduling:appointments': F, 'clinical:prescriptions': R,
    'billing:invoices': N, 'staff:profiles': L, 'reporting:reports': N, 'system:settings': N,
    'identity:users': N, 'identity:auditLogs': N,
  },
  [UserRole.FrontDesk]: {
    'patient:profiles': L, 'clinical:notes': N, 'scheduling:appointments': F, 'clinical:prescriptions': N,
    'billing:invoices': L, 'staff:profiles': L, 'reporting:reports': N, 'system:settings': N,
    'identity:users': N, 'identity:auditLogs': N,
  },
  [UserRole.BillingSpecialist]: {
    'patient:profiles': L, 'clinical:notes': N, 'scheduling:appointments': R, 'clinical:prescriptions': N,
    'billing:invoices': F, 'staff:profiles': L, 'reporting:reports': L, 'system:settings': N,
    'identity:users': N, 'identity:auditLogs': N,
  },
  [UserRole.Patient]: {
    'patient:profiles': N, 'clinical:notes': N, 'scheduling:appointments': L, 'clinical:prescriptions': R,
    'billing:invoices': L, 'staff:profiles': L, 'reporting:reports': N, 'system:settings': N,
    'identity:users': N, 'identity:auditLogs': N,
  },
};

/** Access needed for an operation: `read` = any access, `write` = full or limited, `full` = full only. */
export type AccessKind = 'read' | 'write' | 'full';

const ACCEPTED: Readonly<Record<AccessKind, ReadonlyArray<PermissionLevel>>> = {
  read: [F, L, R],
  write: [F, L],
  full: [F],
};

export function permissionLevel(role: string | null | undefined, capability: CapabilityKey): PermissionLevel {
  return PERMISSION_MATRIX[role as UserRole]?.[capability] ?? N;
}

export function hasAccess(role: string | null | undefined, capability: CapabilityKey, kind: AccessKind): boolean {
  return ACCEPTED[kind].includes(permissionLevel(role, capability));
}

export interface PermissionRule {
  readonly capability: CapabilityKey;
  readonly access: AccessKind;
}

/** True when the role satisfies any of the rules. */
export function satisfiesAny(role: string | null | undefined, rules: ReadonlyArray<PermissionRule>): boolean {
  return rules.some(r => hasAccess(role, r.capability, r.access));
}

/**
 * Practice admins have limited user management (PRD §3.2 "L"): they cannot grant,
 * edit, or remove the super-admin role. Super admins can manage everyone.
 */
export function canManageAccount(actorRole: string | null | undefined, targetRole: string, newRole?: string): boolean {
  const level = permissionLevel(actorRole, 'identity:users');
  if (level === F) return true;
  if (level !== L) return false;
  return targetRole !== UserRole.SuperAdmin && newRole !== UserRole.SuperAdmin;
}

// ── Patient profile field groups ──────────────────────────────────────────────
/**
 * Medical fields on the Patient aggregate. Roles with only limited patient access
 * (front desk, billing) may edit demographics, contact, and insurance but not these.
 */
export const PATIENT_MEDICAL_FIELDS: ReadonlyArray<string> = [
  'bloodType', 'heightCm', 'weightKg', 'allergies', 'chronicConditions', 'currentMedications',
  'pastSurgeries', 'familyHistory', 'immunizationLog', 'alerts',
];

// ── Password policy (PRD §5.1) ────────────────────────────────────────────────
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_AGE_DAYS = 90;
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;
export const STAFF_IDLE_TIMEOUT_MINUTES = 15;

/** Returns the unmet password rules (empty when the password is acceptable). */
export function passwordPolicyErrors(password: string): string[] {
  const errors: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) errors.push(`At least ${PASSWORD_MIN_LENGTH} characters`);
  if (!/[a-z]/.test(password)) errors.push('A lowercase letter');
  if (!/[A-Z]/.test(password)) errors.push('An uppercase letter');
  if (!/\d/.test(password)) errors.push('A number');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('A symbol');
  return errors;
}

export function isPasswordExpired(passwordChangedAt: Date | string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(passwordChangedAt).getTime() > PASSWORD_MAX_AGE_DAYS * 86_400_000;
}

// ── Audit log ─────────────────────────────────────────────────────────────────
export enum AuditAction {
  View = 'VIEW',
  Create = 'CREATE',
  Update = 'UPDATE',
  Delete = 'DELETE',
  Sign = 'SIGN',
  Login = 'LOGIN',
  LoginFailed = 'LOGIN_FAILED',
  AccountLocked = 'ACCOUNT_LOCKED',
  Logout = 'LOGOUT',
  PasswordChanged = 'PASSWORD_CHANGED',
  PasswordReset = 'PASSWORD_RESET',
  RoleChanged = 'ROLE_CHANGED',
  AccountStatusChanged = 'ACCOUNT_STATUS_CHANGED',
}

export interface AuditLogEntry {
  readonly id: string;
  readonly userId: string | null;
  readonly userName: string | null;
  readonly userRole: string | null;
  readonly action: AuditAction;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly patientId: string | null;
  readonly patientName?: string;
  readonly fieldName: string | null;
  readonly oldValue: string | null;
  readonly newValue: string | null;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly createdAt: Date;
}

export interface AuditLogFilters {
  userId?: string;
  patientId?: string;
  action?: AuditAction | AuditAction[];
  resourceType?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}
