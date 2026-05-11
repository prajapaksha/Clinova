// ── Branded IDs ───────────────────────────────────────────────────────────────
export type PortalMessageId = string & { readonly _brand: 'PortalMessageId' };

// ── Enums ─────────────────────────────────────────────────────────────────────
export enum PortalMessageStatus {
  Unread = 'UNREAD',
  Read = 'READ',
  Replied = 'REPLIED',
  Archived = 'ARCHIVED',
}

export enum PortalMessageDirection {
  PatientToStaff = 'PATIENT_TO_STAFF',
  StaffToPatient = 'STAFF_TO_PATIENT',
}

export enum SelfSchedulingSlotStatus {
  Available = 'AVAILABLE',
  Booked = 'BOOKED',
  Blocked = 'BLOCKED',
}

export enum DemographicsUpdateStatus {
  Pending = 'PENDING',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
}

// ── Value Objects ─────────────────────────────────────────────────────────────
export interface SelfSchedulingConstraints {
  readonly patientId: string;
  readonly allowedProviderIds: ReadonlyArray<string>;
  readonly allowedAppointmentTypeIds: ReadonlyArray<string>;
  readonly earliestDate: Date;
  readonly latestDate: Date;
  readonly cancellationCutoffHours: number;
  readonly maxAdvanceBookingDays: number;
}

export interface AvailableSlot {
  readonly providerId: string;
  readonly providerName: string;
  readonly providerPhotoUrl: string | null;
  readonly start: Date;
  readonly end: Date;
  readonly appointmentTypeId: string;
  readonly appointmentTypeName: string;
  readonly status: SelfSchedulingSlotStatus;
}

// ── Entities ──────────────────────────────────────────────────────────────────
export interface PortalMessage {
  readonly id: PortalMessageId;
  readonly threadId: string;
  readonly patientId: string;
  readonly authorId: string;
  readonly authorType: 'patient' | 'staff';
  readonly direction: PortalMessageDirection;
  readonly subject: string | null;
  readonly body: string;
  readonly status: PortalMessageStatus;
  readonly isUrgentDisclaimer: boolean;
  readonly sentAt: Date;
  readonly readAt: Date | null;
}

export interface DemographicsChange {
  readonly old: unknown;
  readonly new: unknown;
}

export interface PatientDemographicsUpdateRequest {
  readonly id: string;
  readonly patientId: string;
  readonly submittedAt: Date;
  readonly status: DemographicsUpdateStatus;
  readonly changes: Record<string, DemographicsChange>;
  readonly reviewedBy: string | null;
  readonly reviewedAt: Date | null;
  readonly rejectionReason: string | null;
}

// ── Domain Events ─────────────────────────────────────────────────────────────
export interface PortalMessageSentEvent {
  readonly type: 'portal.PortalMessageSent';
  readonly messageId: PortalMessageId;
  readonly patientId: string;
  readonly direction: PortalMessageDirection;
  readonly timestamp: Date;
}

export interface SelfSchedulingBookedEvent {
  readonly type: 'portal.SelfSchedulingBooked';
  readonly patientId: string;
  readonly appointmentId: string;
  readonly providerId: string;
  readonly slot: { readonly start: Date; readonly end: Date };
  readonly timestamp: Date;
}

export interface DemographicsUpdateRequestedEvent {
  readonly type: 'portal.DemographicsUpdateRequested';
  readonly requestId: string;
  readonly patientId: string;
  readonly changedFields: ReadonlyArray<string>;
  readonly timestamp: Date;
}

export type PortalDomainEvent =
  | PortalMessageSentEvent
  | SelfSchedulingBookedEvent
  | DemographicsUpdateRequestedEvent;

// ── Repository Interfaces ─────────────────────────────────────────────────────
export interface PortalMessageRepository {
  findById(id: PortalMessageId): Promise<PortalMessage | null>;
  findByThread(threadId: string): Promise<PortalMessage[]>;
  findByPatient(patientId: string, status?: PortalMessageStatus): Promise<PortalMessage[]>;
  findUnread(assignedToProviderId?: string): Promise<PortalMessage[]>;
  save(message: Omit<PortalMessage, 'id'>): Promise<PortalMessage>;
  markRead(id: PortalMessageId): Promise<void>;
}

export interface DemographicsUpdateRepository {
  findById(id: string): Promise<PatientDemographicsUpdateRequest | null>;
  findPending(): Promise<PatientDemographicsUpdateRequest[]>;
  findByPatient(patientId: string): Promise<PatientDemographicsUpdateRequest[]>;
  save(request: Omit<PatientDemographicsUpdateRequest, 'id' | 'submittedAt'>): Promise<PatientDemographicsUpdateRequest>;
  approve(id: string, reviewedBy: string): Promise<PatientDemographicsUpdateRequest>;
  reject(id: string, reviewedBy: string, reason: string): Promise<PatientDemographicsUpdateRequest>;
}
