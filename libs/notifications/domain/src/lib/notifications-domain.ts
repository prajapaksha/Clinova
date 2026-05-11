// ── Branded IDs ───────────────────────────────────────────────────────────────
export type NotificationTemplateId = string & { readonly _brand: 'NotificationTemplateId' };
export type NotificationLogId = string & { readonly _brand: 'NotificationLogId' };

// ── Enums ─────────────────────────────────────────────────────────────────────
export enum NotificationChannel {
  Email = 'EMAIL',
  SMS = 'SMS',
  InApp = 'IN_APP',
  PatientPortal = 'PATIENT_PORTAL',
}

export enum NotificationTrigger {
  AppointmentConfirmation = 'APPOINTMENT_CONFIRMATION',
  AppointmentReminder48h = 'APPOINTMENT_REMINDER_48H',
  AppointmentReminder2h = 'APPOINTMENT_REMINDER_2H',
  AppointmentReschedule = 'APPOINTMENT_RESCHEDULE',
  AppointmentCancellation = 'APPOINTMENT_CANCELLATION',
  NoShowFollowUp = 'NO_SHOW_FOLLOW_UP',
  InvoiceIssued = 'INVOICE_ISSUED',
  PaymentReceipt = 'PAYMENT_RECEIPT',
  StatementReminder30d = 'STATEMENT_REMINDER_30D',
  StatementReminder60d = 'STATEMENT_REMINDER_60D',
  DocumentAvailable = 'DOCUMENT_AVAILABLE',
  PrescriptionRefillReady = 'PRESCRIPTION_REFILL_READY',
  LabResultsReady = 'LAB_RESULTS_READY',
}

export enum NotificationStatus {
  Pending = 'PENDING',
  Sent = 'SENT',
  Failed = 'FAILED',
  Suppressed = 'SUPPRESSED',
}

// ── Value Objects ─────────────────────────────────────────────────────────────
export type MergeField =
  | '{{patient_first_name}}'
  | '{{patient_last_name}}'
  | '{{appointment_date}}'
  | '{{appointment_time}}'
  | '{{provider_name}}'
  | '{{practice_name}}'
  | '{{portal_link}}'
  | '{{invoice_amount}}'
  | '{{balance_amount}}';

export interface NotificationPreferences {
  readonly patientId: string;
  readonly emailOptIn: boolean;
  readonly smsOptIn: boolean;
  readonly portalOptIn: boolean;
  readonly optOutTriggers: ReadonlyArray<NotificationTrigger>;
}

// ── Entities ──────────────────────────────────────────────────────────────────
export interface NotificationTemplate {
  readonly id: NotificationTemplateId;
  readonly trigger: NotificationTrigger;
  readonly channel: NotificationChannel;
  readonly name: string;
  readonly subjectTemplate: string | null;
  readonly bodyTemplate: string;
  readonly isActive: boolean;
  readonly updatedAt: Date;
}

export interface NotificationLog {
  readonly id: NotificationLogId;
  readonly trigger: NotificationTrigger;
  readonly channel: NotificationChannel;
  readonly recipientId: string;
  readonly recipientAddress: string;
  readonly subject: string | null;
  readonly body: string;
  readonly status: NotificationStatus;
  readonly errorMessage: string | null;
  readonly relatedEntityType: string;
  readonly relatedEntityId: string;
  readonly sentAt: Date | null;
  readonly createdAt: Date;
}

// ── Domain Events ─────────────────────────────────────────────────────────────
export interface NotificationSentEvent {
  readonly type: 'notifications.NotificationSent';
  readonly logId: NotificationLogId;
  readonly trigger: NotificationTrigger;
  readonly channel: NotificationChannel;
  readonly recipientId: string;
  readonly timestamp: Date;
}

export interface NotificationFailedEvent {
  readonly type: 'notifications.NotificationFailed';
  readonly logId: NotificationLogId;
  readonly trigger: NotificationTrigger;
  readonly channel: NotificationChannel;
  readonly errorMessage: string;
  readonly timestamp: Date;
}

export type NotificationsDomainEvent =
  | NotificationSentEvent
  | NotificationFailedEvent;

// ── Repository Interfaces ─────────────────────────────────────────────────────
export interface NotificationTemplateRepository {
  findByTriggerAndChannel(trigger: NotificationTrigger, channel: NotificationChannel): Promise<NotificationTemplate | null>;
  findAll(activeOnly?: boolean): Promise<NotificationTemplate[]>;
  save(template: Omit<NotificationTemplate, 'id'>): Promise<NotificationTemplate>;
  update(id: NotificationTemplateId, updates: Partial<Omit<NotificationTemplate, 'id'>>): Promise<NotificationTemplate>;
}

export interface NotificationLogRepository {
  save(log: Omit<NotificationLog, 'id' | 'createdAt'>): Promise<NotificationLog>;
  findByRelatedEntity(entityType: string, entityId: string): Promise<NotificationLog[]>;
  findByRecipient(recipientId: string, limit?: number): Promise<NotificationLog[]>;
}

export interface NotificationPreferencesRepository {
  findByPatient(patientId: string): Promise<NotificationPreferences | null>;
  save(prefs: NotificationPreferences): Promise<NotificationPreferences>;
}
