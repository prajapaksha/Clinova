// ── Branded IDs ───────────────────────────────────────────────────────────────
export type StaffId = string & { readonly _brand: 'StaffId' };
export type ProviderId = string & { readonly _brand: 'ProviderId' };
export type CredentialId = string & { readonly _brand: 'CredentialId' };
export type TimeOffId = string & { readonly _brand: 'TimeOffId' };

// ── Enums ─────────────────────────────────────────────────────────────────────
export enum CredentialType {
  MedicalLicense = 'MEDICAL_LICENSE',
  DEA = 'DEA',
  BoardCertification = 'BOARD_CERTIFICATION',
  NPI = 'NPI',
  Malpractice = 'MALPRACTICE',
  Other = 'OTHER',
}

export enum TimeOffStatus {
  Pending = 'PENDING',
  Approved = 'APPROVED',
  Denied = 'DENIED',
  Cancelled = 'CANCELLED',
}

export enum DayOfWeek {
  Sunday = 0,
  Monday = 1,
  Tuesday = 2,
  Wednesday = 3,
  Thursday = 4,
  Friday = 5,
  Saturday = 6,
}

// ── Value Objects ─────────────────────────────────────────────────────────────
export interface WorkingHoursSlot {
  readonly start: string;
  readonly end: string;
}

export interface DaySchedule {
  readonly dayOfWeek: DayOfWeek;
  readonly isWorking: boolean;
  readonly slots: ReadonlyArray<WorkingHoursSlot>;
  readonly lunchBreak: WorkingHoursSlot | null;
}

// ── Entities ──────────────────────────────────────────────────────────────────
export interface Credential {
  readonly id: CredentialId;
  readonly type: CredentialType;
  readonly number: string;
  readonly issuingState: string | null;
  readonly issuingAuthority: string | null;
  readonly issueDate: Date | null;
  readonly expirationDate: Date | null;
  readonly isVerified: boolean;
}

export interface TimeOffRequest {
  readonly id: TimeOffId;
  readonly staffId: StaffId;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly reason: string | null;
  readonly status: TimeOffStatus;
  readonly reviewedBy: string | null;
  readonly reviewedAt: Date | null;
  readonly createdAt: Date;
}

/** StaffMember aggregate root */
export interface StaffMember {
  readonly id: StaffId;
  readonly userId: string;
  readonly title: string | null;
  readonly firstName: string;
  readonly lastName: string;
  readonly suffix: string | null;
  readonly displayName: string;
  readonly photoUrl: string | null;
  readonly workEmail: string;
  readonly directPhone: string | null;
  readonly locationId: string | null;
  readonly weeklySchedule: ReadonlyArray<DaySchedule>;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Provider — a StaffMember with clinical credentials (Doctor, NP, PA) */
export interface Provider extends StaffMember {
  readonly providerId: ProviderId;
  readonly npi: string;
  readonly specialties: ReadonlyArray<string>;
  readonly credentials: ReadonlyArray<Credential>;
  readonly bio: string | null;
  readonly defaultAppointmentDurationMinutes: number;
  readonly bufferBetweenAppointmentsMinutes: number;
  readonly acceptedInsuranceNetworks: ReadonlyArray<string>;
  readonly defaultFeeScheduleId: string | null;
}

// ── Domain Events ─────────────────────────────────────────────────────────────
export interface CredentialExpiringEvent {
  readonly type: 'staff.CredentialExpiring';
  readonly staffId: StaffId;
  readonly credentialId: CredentialId;
  readonly credentialType: CredentialType;
  readonly expirationDate: Date;
  readonly daysUntilExpiry: number;
  readonly timestamp: Date;
}

export interface TimeOffRequestedEvent {
  readonly type: 'staff.TimeOffRequested';
  readonly staffId: StaffId;
  readonly timeOffId: TimeOffId;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly timestamp: Date;
}

export interface TimeOffApprovedEvent {
  readonly type: 'staff.TimeOffApproved';
  readonly staffId: StaffId;
  readonly timeOffId: TimeOffId;
  readonly approvedBy: string;
  readonly timestamp: Date;
}

export interface ProviderScheduleUpdatedEvent {
  readonly type: 'staff.ProviderScheduleUpdated';
  readonly providerId: ProviderId;
  readonly timestamp: Date;
}

export type StaffDomainEvent =
  | CredentialExpiringEvent
  | TimeOffRequestedEvent
  | TimeOffApprovedEvent
  | ProviderScheduleUpdatedEvent;

// ── Repository Interfaces ─────────────────────────────────────────────────────
export interface StaffFilters {
  isActive?: boolean;
  locationId?: string;
  limit?: number;
  offset?: number;
}

export interface StaffRepository {
  findById(id: StaffId): Promise<StaffMember | null>;
  findAll(filters?: StaffFilters): Promise<StaffMember[]>;
  save(staff: Omit<StaffMember, 'id' | 'createdAt' | 'updatedAt'>): Promise<StaffMember>;
  update(id: StaffId, updates: Partial<Omit<StaffMember, 'id' | 'createdAt'>>): Promise<StaffMember>;
  deactivate(id: StaffId): Promise<void>;
}

export interface ProviderRepository {
  findById(id: ProviderId): Promise<Provider | null>;
  findByStaffId(staffId: StaffId): Promise<Provider | null>;
  findAll(filters?: StaffFilters & { specialty?: string }): Promise<Provider[]>;
  save(provider: Omit<Provider, 'id' | 'providerId' | 'createdAt' | 'updatedAt'>): Promise<Provider>;
  update(id: ProviderId, updates: Partial<Omit<Provider, 'id' | 'providerId' | 'createdAt'>>): Promise<Provider>;
}

export interface TimeOffRepository {
  findById(id: TimeOffId): Promise<TimeOffRequest | null>;
  findByStaff(staffId: StaffId, year?: number): Promise<TimeOffRequest[]>;
  findPending(): Promise<TimeOffRequest[]>;
  findConflicts(staffId: StaffId, startDate: Date, endDate: Date): Promise<TimeOffRequest[]>;
  save(request: Omit<TimeOffRequest, 'id' | 'createdAt'>): Promise<TimeOffRequest>;
  updateStatus(id: TimeOffId, status: TimeOffStatus, reviewedBy: string): Promise<TimeOffRequest>;
}
