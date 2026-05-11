// ── Branded IDs ───────────────────────────────────────────────────────────────
export type AppointmentId = string & { readonly _brand: 'AppointmentId' };
export type AppointmentTypeId = string & { readonly _brand: 'AppointmentTypeId' };
export type WaitlistEntryId = string & { readonly _brand: 'WaitlistEntryId' };
export type RecurringSeriesId = string & { readonly _brand: 'RecurringSeriesId' };

// ── Enums ─────────────────────────────────────────────────────────────────────
export enum AppointmentStatus {
  Scheduled = 'SCHEDULED',
  Confirmed = 'CONFIRMED',
  CheckedIn = 'CHECKED_IN',
  InProgress = 'IN_PROGRESS',
  Completed = 'COMPLETED',
  Cancelled = 'CANCELLED',
  NoShow = 'NO_SHOW',
  Rescheduled = 'RESCHEDULED',
}

export const APPOINTMENT_STATUS_COLOR: Record<AppointmentStatus, string> = {
  [AppointmentStatus.Scheduled]:   '#9E9E9E',
  [AppointmentStatus.Confirmed]:   '#1976D2',
  [AppointmentStatus.CheckedIn]:   '#F9A825',
  [AppointmentStatus.InProgress]:  '#7B1FA2',
  [AppointmentStatus.Completed]:   '#388E3C',
  [AppointmentStatus.Cancelled]:   '#BDBDBD',
  [AppointmentStatus.NoShow]:      '#D32F2F',
  [AppointmentStatus.Rescheduled]: '#F57C00',
};

export enum CancellationReason {
  PatientRequest = 'PATIENT_REQUEST',
  ProviderUnavailable = 'PROVIDER_UNAVAILABLE',
  EmergencyRescheduled = 'EMERGENCY_RESCHEDULED',
  InsuranceIssue = 'INSURANCE_ISSUE',
  Other = 'OTHER',
}

export enum RecurrencePattern {
  Daily = 'DAILY',
  Weekly = 'WEEKLY',
  BiWeekly = 'BI_WEEKLY',
  Monthly = 'MONTHLY',
}

// ── Value Objects ─────────────────────────────────────────────────────────────
export interface TimeSlot {
  readonly start: Date;
  readonly end: Date;
}

export interface DateRange {
  readonly from: Date;
  readonly to: Date;
}

// ── Entities ──────────────────────────────────────────────────────────────────
export interface AppointmentType {
  readonly id: AppointmentTypeId;
  readonly name: string;
  readonly defaultDurationMinutes: number;
  readonly bufferAfterMinutes: number;
  readonly color: string;
  readonly isActive: boolean;
}

export interface AppointmentReminder {
  readonly sentAt: Date;
  readonly channel: string;
  readonly status: 'sent' | 'failed';
}

/** Appointment aggregate root */
export interface Appointment {
  readonly id: AppointmentId;
  readonly patientId: string;
  readonly providerId: string;
  readonly locationId: string;
  readonly appointmentTypeId: AppointmentTypeId;
  readonly slot: TimeSlot;
  readonly status: AppointmentStatus;
  readonly reasonForVisit: string | null;
  readonly notes: string | null;
  readonly cancellationReason: CancellationReason | null;
  readonly cancellationNote: string | null;
  readonly recurringSeriesId: RecurringSeriesId | null;
  readonly rescheduledFromId: AppointmentId | null;
  readonly rescheduledToId: AppointmentId | null;
  readonly checkedInAt: Date | null;
  readonly completedAt: Date | null;
  readonly reminders: ReadonlyArray<AppointmentReminder>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface RecurringSeries {
  readonly id: RecurringSeriesId;
  readonly patientId: string;
  readonly providerId: string;
  readonly appointmentTypeId: AppointmentTypeId;
  readonly pattern: RecurrencePattern;
  readonly intervalWeeks: number | null;
  readonly startDate: Date;
  readonly endDate: Date | null;
  readonly maxOccurrences: number | null;
  readonly isActive: boolean;
}

export interface WaitlistEntry {
  readonly id: WaitlistEntryId;
  readonly patientId: string;
  readonly providerId: string | null;
  readonly appointmentTypeId: AppointmentTypeId;
  readonly preferredDateRange: DateRange;
  readonly notes: string | null;
  readonly addedAt: Date;
  readonly fulfilledAt: Date | null;
  readonly fulfilledAppointmentId: AppointmentId | null;
}

// ── Domain Events ─────────────────────────────────────────────────────────────
export interface AppointmentBookedEvent {
  readonly type: 'scheduling.AppointmentBooked';
  readonly appointmentId: AppointmentId;
  readonly patientId: string;
  readonly providerId: string;
  readonly slot: TimeSlot;
  readonly timestamp: Date;
}

export interface AppointmentConfirmedEvent {
  readonly type: 'scheduling.AppointmentConfirmed';
  readonly appointmentId: AppointmentId;
  readonly timestamp: Date;
}

export interface AppointmentCheckedInEvent {
  readonly type: 'scheduling.AppointmentCheckedIn';
  readonly appointmentId: AppointmentId;
  readonly patientId: string;
  readonly checkedInAt: Date;
  readonly timestamp: Date;
}

export interface AppointmentCompletedEvent {
  readonly type: 'scheduling.AppointmentCompleted';
  readonly appointmentId: AppointmentId;
  readonly patientId: string;
  readonly providerId: string;
  readonly timestamp: Date;
}

export interface AppointmentCancelledEvent {
  readonly type: 'scheduling.AppointmentCancelled';
  readonly appointmentId: AppointmentId;
  readonly patientId: string;
  readonly reason: CancellationReason;
  readonly cancelledBy: string;
  readonly timestamp: Date;
}

export interface AppointmentNoShowEvent {
  readonly type: 'scheduling.AppointmentNoShow';
  readonly appointmentId: AppointmentId;
  readonly patientId: string;
  readonly timestamp: Date;
}

export interface AppointmentRescheduledEvent {
  readonly type: 'scheduling.AppointmentRescheduled';
  readonly originalAppointmentId: AppointmentId;
  readonly newAppointmentId: AppointmentId;
  readonly patientId: string;
  readonly timestamp: Date;
}

export type SchedulingDomainEvent =
  | AppointmentBookedEvent
  | AppointmentConfirmedEvent
  | AppointmentCheckedInEvent
  | AppointmentCompletedEvent
  | AppointmentCancelledEvent
  | AppointmentNoShowEvent
  | AppointmentRescheduledEvent;

// ── Repository Interfaces ─────────────────────────────────────────────────────
export interface AppointmentFilters {
  providerId?: string;
  patientId?: string;
  status?: AppointmentStatus | AppointmentStatus[];
  dateRange?: DateRange;
  limit?: number;
  offset?: number;
}

export interface AppointmentRepository {
  findById(id: AppointmentId): Promise<Appointment | null>;
  findMany(filters: AppointmentFilters): Promise<{ appointments: Appointment[]; total: number }>;
  findConflicts(providerId: string, slot: TimeSlot, excludeId?: AppointmentId): Promise<Appointment[]>;
  save(appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Appointment>;
  update(id: AppointmentId, updates: Partial<Omit<Appointment, 'id' | 'createdAt'>>): Promise<Appointment>;
}

export interface AppointmentTypeRepository {
  findById(id: AppointmentTypeId): Promise<AppointmentType | null>;
  findAll(activeOnly?: boolean): Promise<AppointmentType[]>;
  save(type: Omit<AppointmentType, 'id'>): Promise<AppointmentType>;
  update(id: AppointmentTypeId, updates: Partial<Omit<AppointmentType, 'id'>>): Promise<AppointmentType>;
}

export interface WaitlistRepository {
  findById(id: WaitlistEntryId): Promise<WaitlistEntry | null>;
  findByPatient(patientId: string): Promise<WaitlistEntry[]>;
  findOpen(): Promise<WaitlistEntry[]>;
  save(entry: Omit<WaitlistEntry, 'id' | 'addedAt'>): Promise<WaitlistEntry>;
  fulfill(id: WaitlistEntryId, appointmentId: AppointmentId): Promise<void>;
}
