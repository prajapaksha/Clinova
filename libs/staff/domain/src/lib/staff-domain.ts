// ── Branded IDs ───────────────────────────────────────────────────────────────
export type StaffId = string & { readonly _brand: 'StaffId' };
export type CredentialId = string & { readonly _brand: 'CredentialId' };

// ── Enums ─────────────────────────────────────────────────────────────────────
export enum CredentialType {
  MedicalLicense = 'MEDICAL_LICENSE',
  DEA = 'DEA',
  BoardCertification = 'BOARD_CERTIFICATION',
  NPI = 'NPI',
  Malpractice = 'MALPRACTICE',
  BLS = 'BLS',
  Other = 'OTHER',
}

export const CREDENTIAL_TYPE_LABELS: Readonly<Record<CredentialType, string>> = {
  [CredentialType.MedicalLicense]: 'Medical license',
  [CredentialType.DEA]: 'DEA registration',
  [CredentialType.BoardCertification]: 'Board certification',
  [CredentialType.NPI]: 'NPI',
  [CredentialType.Malpractice]: 'Malpractice insurance',
  [CredentialType.BLS]: 'BLS / CPR',
  [CredentialType.Other]: 'Other',
};

/** Expiry bands from PRD §4.3: alerts at 90 / 30 / 7 days out. */
export type CredentialExpiryStatus = 'EXPIRED' | 'DUE_7' | 'DUE_30' | 'DUE_90' | 'VALID' | 'NO_EXPIRY';

export const CREDENTIAL_ALERT_DAYS = [90, 30, 7] as const;

// ── Value objects ─────────────────────────────────────────────────────────────
export interface WorkingHoursSlot {
  /** HH:mm, 24-hour. */
  readonly start: string;
  readonly end: string;
}

export interface DaySchedule {
  /** 0 = Sunday … 6 = Saturday. */
  readonly dayOfWeek: number;
  readonly isWorking: boolean;
  readonly hours: WorkingHoursSlot | null;
  readonly lunchBreak: WorkingHoursSlot | null;
}

// ── Read models ───────────────────────────────────────────────────────────────
export interface StaffCredential {
  readonly id: CredentialId;
  readonly staffId: StaffId;
  readonly type: CredentialType;
  readonly number: string;
  readonly issuingState: string | null;
  readonly issuingAuthority: string | null;
  readonly issueDate: Date | null;
  readonly expirationDate: Date | null;
  readonly isVerified: boolean;
  readonly status: CredentialExpiryStatus;
  readonly daysUntilExpiry: number | null;
}

export interface StaffSummary {
  readonly id: StaffId;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly title: string | null;
  readonly suffix: string | null;
  readonly displayName: string;
  readonly role: string;
  readonly isActive: boolean;
  readonly phone: string | null;
  readonly officeLocation: string | null;
  readonly npi: string | null;
  readonly specialties: ReadonlyArray<string>;
  /** Most urgent credential status, for directory badges. */
  readonly credentialStatus: CredentialExpiryStatus;
}

export interface StaffSecurity {
  readonly lastLoginAt: Date | null;
  readonly lockedUntil: Date | null;
  readonly failedLoginAttempts: number;
  readonly passwordChangedAt: Date;
  readonly passwordExpired: boolean;
  readonly mfaEnabled: boolean;
}

export interface StaffProfile extends StaffSummary {
  readonly bio: string | null;
  readonly schedule: ReadonlyArray<DaySchedule>;
  readonly credentials: ReadonlyArray<StaffCredential>;
  /** Present for account managers and for the user viewing their own profile. */
  readonly security?: StaffSecurity;
  readonly createdAt: Date;
}

export interface ExpiringCredential extends StaffCredential {
  readonly staffName: string;
  readonly staffRole: string;
}

export interface StaffFilters {
  role?: string;
  status?: 'active' | 'inactive' | 'all';
  specialty?: string;
  search?: string;
}

// ── Domain events ─────────────────────────────────────────────────────────────
export interface CredentialExpiringEvent {
  readonly type: 'staff.CredentialExpiring';
  readonly staffId: StaffId;
  readonly credentialId: CredentialId;
  readonly credentialType: CredentialType;
  readonly expirationDate: Date;
  readonly daysUntilExpiry: number;
  readonly timestamp: Date;
}

// ── Rules ─────────────────────────────────────────────────────────────────────
const DAY_MS = 86_400_000;

export function daysUntil(date: Date | string | null | undefined, now: Date = new Date()): number | null {
  if (!date) return null;
  const d = new Date(date);
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((end - start) / DAY_MS);
}

export function credentialExpiryStatus(expirationDate: Date | string | null | undefined, now: Date = new Date()): CredentialExpiryStatus {
  const days = daysUntil(expirationDate, now);
  if (days === null) return 'NO_EXPIRY';
  if (days < 0) return 'EXPIRED';
  if (days <= 7) return 'DUE_7';
  if (days <= 30) return 'DUE_30';
  if (days <= 90) return 'DUE_90';
  return 'VALID';
}

const STATUS_RANK: Record<CredentialExpiryStatus, number> = {
  EXPIRED: 0, DUE_7: 1, DUE_30: 2, DUE_90: 3, VALID: 4, NO_EXPIRY: 5,
};

export function mostUrgentStatus(statuses: ReadonlyArray<CredentialExpiryStatus>): CredentialExpiryStatus {
  return statuses.reduce<CredentialExpiryStatus>((worst, s) => (STATUS_RANK[s] < STATUS_RANK[worst] ? s : worst), 'NO_EXPIRY');
}

export function isCredentialAlert(status: CredentialExpiryStatus): boolean {
  return status === 'EXPIRED' || status === 'DUE_7' || status === 'DUE_30' || status === 'DUE_90';
}

export function displayName(s: { title?: string | null; firstName: string; lastName: string; suffix?: string | null }): string {
  return [s.title, s.firstName, s.lastName].filter(Boolean).join(' ') + (s.suffix ? `, ${s.suffix}` : '');
}

/** Mon–Fri 8:00–17:00 with a 12:00–13:00 lunch. */
export function defaultWeeklySchedule(): DaySchedule[] {
  return Array.from({ length: 7 }, (_, day) => {
    const working = day >= 1 && day <= 5;
    return {
      dayOfWeek: day,
      isWorking: working,
      hours: working ? { start: '08:00', end: '17:00' } : null,
      lunchBreak: working ? { start: '12:00', end: '13:00' } : null,
    };
  });
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Returns problems with a weekly schedule (empty when valid). */
export function scheduleErrors(schedule: ReadonlyArray<DaySchedule>): string[] {
  const errors: string[] = [];
  const days = new Set(schedule.map(d => d.dayOfWeek));
  if (schedule.length !== 7 || days.size !== 7) errors.push('Provide exactly one entry per day of the week.');
  for (const d of schedule) {
    if (!d.isWorking) continue;
    const label = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.dayOfWeek] ?? `Day ${d.dayOfWeek}`;
    if (!d.hours || !TIME.test(d.hours.start) || !TIME.test(d.hours.end) || d.hours.start >= d.hours.end) {
      errors.push(`${label}: working hours must start before they end.`);
      continue;
    }
    if (d.lunchBreak) {
      const { start, end } = d.lunchBreak;
      if (!TIME.test(start) || !TIME.test(end) || start >= end || start < d.hours.start || end > d.hours.end) {
        errors.push(`${label}: lunch break must fall within working hours.`);
      }
    }
  }
  return errors;
}
