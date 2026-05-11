// ── Branded IDs ───────────────────────────────────────────────────────────────
export type UserId = string & { readonly _brand: 'UserId' };
export type RoleId = string & { readonly _brand: 'RoleId' };

// ── Enums ─────────────────────────────────────────────────────────────────────
export enum UserRole {
  SuperAdmin = 'SUPER_ADMIN',
  Admin = 'ADMIN',
  Doctor = 'DOCTOR',
  Nurse = 'NURSE',
  FrontDesk = 'FRONT_DESK',
  BillingSpecialist = 'BILLING_SPECIALIST',
  Patient = 'PATIENT',
}

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

// ── Entities ──────────────────────────────────────────────────────────────────
export interface Permission {
  readonly capability: CapabilityKey;
  readonly level: PermissionLevel;
}

export interface Role {
  readonly id: RoleId;
  readonly name: string;
  readonly description: string;
  readonly permissions: ReadonlyArray<Permission>;
}

/** User aggregate root */
export interface User {
  readonly id: UserId;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly role: UserRole;
  readonly isActive: boolean;
  readonly mfaEnabled: boolean;
  readonly failedLoginAttempts: number;
  readonly lockedUntil: Date | null;
  readonly lastLoginAt: Date | null;
  readonly passwordChangedAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AuditLogEntry {
  readonly id: string;
  readonly userId: UserId;
  readonly patientId: string | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly fieldName: string | null;
  readonly oldValue: unknown;
  readonly newValue: unknown;
  readonly timestamp: Date;
  readonly ipAddress: string;
  readonly userAgent: string;
}

// ── Domain Events ─────────────────────────────────────────────────────────────
export interface UserCreatedEvent {
  readonly type: 'identity.UserCreated';
  readonly userId: UserId;
  readonly role: UserRole;
  readonly timestamp: Date;
}

export interface UserDeactivatedEvent {
  readonly type: 'identity.UserDeactivated';
  readonly userId: UserId;
  readonly deactivatedBy: UserId;
  readonly timestamp: Date;
}

export interface LoginFailedEvent {
  readonly type: 'identity.LoginFailed';
  readonly email: string;
  readonly ipAddress: string;
  readonly timestamp: Date;
}

export interface AccountLockedEvent {
  readonly type: 'identity.AccountLocked';
  readonly userId: UserId;
  readonly lockedUntil: Date;
  readonly timestamp: Date;
}

export type IdentityDomainEvent =
  | UserCreatedEvent
  | UserDeactivatedEvent
  | LoginFailedEvent
  | AccountLockedEvent;

// ── Repository Interfaces ─────────────────────────────────────────────────────
export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(filters?: { role?: UserRole; isActive?: boolean }): Promise<User[]>;
  save(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User>;
  update(id: UserId, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User>;
}

export interface AuditLogRepository {
  log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void>;
  findByPatient(patientId: string, limit?: number): Promise<AuditLogEntry[]>;
  findByUser(userId: UserId, limit?: number): Promise<AuditLogEntry[]>;
}
