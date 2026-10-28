// Notifications bounded context (PRD §4.6). Framework-free rules shared by the API, worker and apps.

export enum NotificationType {
  AppointmentConfirmation = 'APPOINTMENT_CONFIRMATION',
  AppointmentReminder48h = 'APPOINTMENT_REMINDER_48H',
  AppointmentReminder2h = 'APPOINTMENT_REMINDER_2H',
  AppointmentRescheduled = 'APPOINTMENT_RESCHEDULED',
  AppointmentCancelled = 'APPOINTMENT_CANCELLED',
  NoShowFollowUp = 'NO_SHOW_FOLLOW_UP',
  InvoiceIssued = 'INVOICE_ISSUED',
  PaymentReceipt = 'PAYMENT_RECEIPT',
  StatementReminder30d = 'STATEMENT_REMINDER_30D',
  StatementReminder60d = 'STATEMENT_REMINDER_60D',
  DocumentAvailable = 'DOCUMENT_AVAILABLE',
  ResultsReady = 'RESULTS_READY',
  RefillApproved = 'REFILL_APPROVED',
  RefillDenied = 'REFILL_DENIED',
  MessageReceived = 'MESSAGE_RECEIVED',
  ProfileUpdateReviewed = 'PROFILE_UPDATE_REVIEWED',
}

export enum NotificationChannel {
  Email = 'EMAIL',
  SMS = 'SMS',
  Portal = 'PORTAL',
}

export enum NotificationStatus {
  Queued = 'QUEUED',
  Sending = 'SENDING',
  Sent = 'SENT',
  Failed = 'FAILED',
  Suppressed = 'SUPPRESSED',
  Cancelled = 'CANCELLED',
}

/** Patient preference topics (match the portal's notification settings). */
export type PreferenceTopic =
  | 'appointmentReminders'
  | 'appointmentChanges'
  | 'billing'
  | 'documents'
  | 'results'
  | 'prescriptions'
  | 'messages';

export type MergeField =
  | 'patient_first_name'
  | 'patient_last_name'
  | 'practice_name'
  | 'practice_phone'
  | 'portal_link'
  | 'appointment_date'
  | 'appointment_time'
  | 'appointment_type'
  | 'provider_name'
  | 'location'
  | 'invoice_number'
  | 'invoice_amount'
  | 'balance_amount'
  | 'due_date'
  | 'payment_amount'
  | 'payment_method'
  | 'document_name'
  | 'medication_name'
  | 'pharmacy'
  | 'response_note'
  | 'message_subject'
  | 'review_status';

export const MERGE_FIELDS: Readonly<Record<MergeField, { label: string; example: string }>> = {
  patient_first_name: { label: 'Patient first name', example: 'James' },
  patient_last_name: { label: 'Patient last name', example: 'Okafor' },
  practice_name: { label: 'Practice name', example: 'Clinova Health' },
  practice_phone: { label: 'Practice phone', example: '(555) 010-0100' },
  portal_link: { label: 'Patient portal link', example: 'https://portal.clinova.health' },
  appointment_date: { label: 'Appointment date', example: 'Thursday, October 29' },
  appointment_time: { label: 'Appointment time', example: '10:00 AM' },
  appointment_type: { label: 'Visit type', example: 'Follow-Up Visit' },
  provider_name: { label: 'Provider name', example: 'Dr. Ananya Patel, DO' },
  location: { label: 'Location', example: 'Clinic B, Room 112' },
  invoice_number: { label: 'Bill number', example: 'INV-000042' },
  invoice_amount: { label: 'Bill amount', example: '$130.00' },
  balance_amount: { label: 'Balance due', example: '$255.00' },
  due_date: { label: 'Due date', example: 'November 20, 2026' },
  payment_amount: { label: 'Payment amount', example: '$50.00' },
  payment_method: { label: 'Payment method', example: 'Visa •••• 4242' },
  document_name: { label: 'Document name', example: 'Diabetes care plan.pdf' },
  medication_name: { label: 'Medication', example: 'Metformin 1000 mg tablet' },
  pharmacy: { label: 'Pharmacy', example: 'Walgreens - Westheimer Rd' },
  response_note: { label: "Care team's note", example: 'Sent to your pharmacy.' },
  message_subject: { label: 'Message subject', example: 'Question about my dose' },
  review_status: { label: 'Review outcome', example: 'approved' },
};

const PRACTICE: MergeField[] = ['patient_first_name', 'patient_last_name', 'practice_name', 'practice_phone', 'portal_link'];
const APPOINTMENT: MergeField[] = [...PRACTICE, 'appointment_date', 'appointment_time', 'appointment_type', 'provider_name', 'location'];

export interface NotificationTypeSpec {
  readonly label: string;
  /** When it is sent (shown to staff). */
  readonly timing: string;
  readonly channels: ReadonlyArray<NotificationChannel>;
  readonly topic: PreferenceTopic;
  readonly mergeFields: ReadonlyArray<MergeField>;
}

const E = NotificationChannel.Email;
const S = NotificationChannel.SMS;
const P = NotificationChannel.Portal;

/** PRD §4.6 notification matrix (plus portal-driven updates). */
export const NOTIFICATION_TYPES: Readonly<Record<NotificationType, NotificationTypeSpec>> = {
  [NotificationType.AppointmentConfirmation]: { label: 'Appointment confirmation', timing: 'Immediately on booking', channels: [E, S], topic: 'appointmentChanges', mergeFields: APPOINTMENT },
  [NotificationType.AppointmentReminder48h]: { label: 'Appointment reminder (48 hours)', timing: '48 hours before', channels: [E, S], topic: 'appointmentReminders', mergeFields: APPOINTMENT },
  [NotificationType.AppointmentReminder2h]: { label: 'Appointment reminder (2 hours)', timing: '2 hours before', channels: [E, S], topic: 'appointmentReminders', mergeFields: APPOINTMENT },
  [NotificationType.AppointmentRescheduled]: { label: 'Appointment rescheduled', timing: 'Immediately', channels: [E, S], topic: 'appointmentChanges', mergeFields: APPOINTMENT },
  [NotificationType.AppointmentCancelled]: { label: 'Appointment cancelled', timing: 'Immediately', channels: [E, S], topic: 'appointmentChanges', mergeFields: APPOINTMENT },
  [NotificationType.NoShowFollowUp]: { label: 'Missed appointment follow-up', timing: 'Same day', channels: [E], topic: 'appointmentChanges', mergeFields: APPOINTMENT },
  [NotificationType.InvoiceIssued]: { label: 'New bill', timing: 'When a bill is issued', channels: [E, P], topic: 'billing', mergeFields: [...PRACTICE, 'invoice_number', 'invoice_amount', 'balance_amount', 'due_date'] },
  [NotificationType.PaymentReceipt]: { label: 'Payment receipt', timing: 'On successful payment', channels: [E, P], topic: 'billing', mergeFields: [...PRACTICE, 'payment_amount', 'payment_method', 'balance_amount'] },
  [NotificationType.StatementReminder30d]: { label: 'Balance reminder (30 days overdue)', timing: '30 days after the oldest bill was due', channels: [E], topic: 'billing', mergeFields: [...PRACTICE, 'invoice_number', 'balance_amount', 'due_date'] },
  [NotificationType.StatementReminder60d]: { label: 'Balance reminder (60 days overdue)', timing: '60 days after the oldest bill was due', channels: [E], topic: 'billing', mergeFields: [...PRACTICE, 'invoice_number', 'balance_amount', 'due_date'] },
  [NotificationType.DocumentAvailable]: { label: 'New document available', timing: 'When staff share a document', channels: [P, E], topic: 'documents', mergeFields: [...PRACTICE, 'document_name'] },
  [NotificationType.ResultsReady]: { label: 'Test results ready', timing: 'When a physician releases a result', channels: [P, E], topic: 'results', mergeFields: [...PRACTICE, 'document_name', 'provider_name'] },
  [NotificationType.RefillApproved]: { label: 'Prescription refill approved', timing: 'When a refill request is approved', channels: [E, S, P], topic: 'prescriptions', mergeFields: [...PRACTICE, 'medication_name', 'pharmacy', 'response_note'] },
  [NotificationType.RefillDenied]: { label: 'Prescription refill update', timing: 'When a refill request is declined', channels: [E, P], topic: 'prescriptions', mergeFields: [...PRACTICE, 'medication_name', 'response_note'] },
  [NotificationType.MessageReceived]: { label: 'New message from the care team', timing: 'When staff reply', channels: [P, E], topic: 'messages', mergeFields: [...PRACTICE, 'message_subject'] },
  [NotificationType.ProfileUpdateReviewed]: { label: 'Profile update reviewed', timing: 'When staff review a change request', channels: [P], topic: 'messages', mergeFields: [...PRACTICE, 'review_status', 'response_note'] },
};

export interface TemplateContent {
  readonly subject: string | null;
  readonly body: string;
}

const SIGN_OFF = '\n\n{{practice_name}} · {{practice_phone}}';
const CHANGE = 'Need to make a change? Visit {{portal_link}} or call {{practice_phone}}.';

/**
 * Built-in templates. Messages avoid diagnoses and other clinical detail: email and SMS are
 * not secure channels, so they point patients to the portal instead.
 */
export const DEFAULT_TEMPLATES: Readonly<Record<NotificationType, Partial<Record<NotificationChannel, TemplateContent>>>> = {
  [NotificationType.AppointmentConfirmation]: {
    [E]: { subject: 'Your appointment on {{appointment_date}} is confirmed', body: `Hi {{patient_first_name}},\n\nYou're booked for a {{appointment_type}} with {{provider_name}} on {{appointment_date}} at {{appointment_time}}.\nLocation: {{location}}\n\n${CHANGE}${SIGN_OFF}` },
    [S]: { subject: null, body: '{{practice_name}}: You\'re booked with {{provider_name}} on {{appointment_date}} at {{appointment_time}}. Reply STOP to opt out.' },
  },
  [NotificationType.AppointmentReminder48h]: {
    [E]: { subject: 'Reminder: appointment on {{appointment_date}}', body: `Hi {{patient_first_name}},\n\nThis is a reminder of your {{appointment_type}} with {{provider_name}} on {{appointment_date}} at {{appointment_time}}.\nLocation: {{location}}\n\nPlease arrive 10 minutes early and bring your insurance card. ${CHANGE}${SIGN_OFF}` },
    [S]: { subject: null, body: '{{practice_name}} reminder: {{provider_name}}, {{appointment_date}} at {{appointment_time}}. To change call {{practice_phone}}. Reply STOP to opt out.' },
  },
  [NotificationType.AppointmentReminder2h]: {
    [E]: { subject: 'See you soon: today at {{appointment_time}}', body: `Hi {{patient_first_name}},\n\nYour appointment with {{provider_name}} is today at {{appointment_time}}.\nLocation: {{location}}${SIGN_OFF}` },
    [S]: { subject: null, body: '{{practice_name}}: See you today at {{appointment_time}} with {{provider_name}}, {{location}}. Reply STOP to opt out.' },
  },
  [NotificationType.AppointmentRescheduled]: {
    [E]: { subject: 'Your appointment has moved to {{appointment_date}}', body: `Hi {{patient_first_name}},\n\nYour {{appointment_type}} with {{provider_name}} is now on {{appointment_date}} at {{appointment_time}}.\nLocation: {{location}}\n\n${CHANGE}${SIGN_OFF}` },
    [S]: { subject: null, body: '{{practice_name}}: Your appointment is now {{appointment_date}} at {{appointment_time}} with {{provider_name}}. Reply STOP to opt out.' },
  },
  [NotificationType.AppointmentCancelled]: {
    [E]: { subject: 'Your appointment on {{appointment_date}} was cancelled', body: `Hi {{patient_first_name}},\n\nYour {{appointment_type}} with {{provider_name}} on {{appointment_date}} at {{appointment_time}} has been cancelled.\n\nTo book a new time, visit {{portal_link}} or call {{practice_phone}}.${SIGN_OFF}` },
    [S]: { subject: null, body: '{{practice_name}}: Your appointment on {{appointment_date}} at {{appointment_time}} was cancelled. Rebook at {{portal_link}}. Reply STOP to opt out.' },
  },
  [NotificationType.NoShowFollowUp]: {
    [E]: { subject: 'We missed you today', body: `Hi {{patient_first_name}},\n\nWe missed you at your appointment with {{provider_name}} today at {{appointment_time}}. We hope everything is okay.\n\nWhen you're ready, you can book a new time at {{portal_link}} or call us at {{practice_phone}}.${SIGN_OFF}` },
  },
  [NotificationType.InvoiceIssued]: {
    [E]: { subject: 'Your bill from {{practice_name}} ({{invoice_number}})', body: `Hi {{patient_first_name}},\n\nA new bill of {{invoice_amount}} is ready (due {{due_date}}). Your total balance is {{balance_amount}}.\n\nView and pay securely at {{portal_link}}.${SIGN_OFF}` },
    [P]: { subject: 'New bill {{invoice_number}}', body: 'A bill of {{invoice_amount}} is due {{due_date}}.' },
  },
  [NotificationType.PaymentReceipt]: {
    [E]: { subject: 'Payment received - thank you', body: `Hi {{patient_first_name}},\n\nWe received your payment of {{payment_amount}} ({{payment_method}}). Your remaining balance is {{balance_amount}}.\n\nYou can see your receipts at {{portal_link}}.${SIGN_OFF}` },
    [P]: { subject: 'Payment received', body: 'Thank you for your payment of {{payment_amount}}. Remaining balance: {{balance_amount}}.' },
  },
  [NotificationType.StatementReminder30d]: {
    [E]: { subject: 'Reminder: balance of {{balance_amount}} is past due', body: `Hi {{patient_first_name}},\n\nYou have a past-due balance of {{balance_amount}} (oldest bill {{invoice_number}}, due {{due_date}}).\n\nPay online at {{portal_link}}, or call us at {{practice_phone}} if you'd like to set up a payment plan.${SIGN_OFF}` },
  },
  [NotificationType.StatementReminder60d]: {
    [E]: { subject: 'Second reminder: {{balance_amount}} is 60 days past due', body: `Hi {{patient_first_name}},\n\nYour balance of {{balance_amount}} is now more than 60 days past due (oldest bill {{invoice_number}}, due {{due_date}}). Please pay at {{portal_link}} or call {{practice_phone}} so we can help.${SIGN_OFF}` },
  },
  [NotificationType.DocumentAvailable]: {
    [P]: { subject: 'New document: {{document_name}}', body: 'The office shared a document with you.' },
    [E]: { subject: 'A new document is in your patient portal', body: `Hi {{patient_first_name}},\n\nThe office shared a new document with you. Sign in to view it securely: {{portal_link}}${SIGN_OFF}` },
  },
  [NotificationType.ResultsReady]: {
    [P]: { subject: 'New result: {{document_name}}', body: '{{provider_name}} reviewed and released your result.' },
    [E]: { subject: 'Your test results are ready', body: `Hi {{patient_first_name}},\n\nYour doctor has reviewed and released a test result. Sign in to the patient portal to see it: {{portal_link}}${SIGN_OFF}` },
  },
  [NotificationType.RefillApproved]: {
    [E]: { subject: 'Your refill was approved', body: `Hi {{patient_first_name}},\n\nYour refill of {{medication_name}} was approved and sent to {{pharmacy}}. {{response_note}}${SIGN_OFF}` },
    [S]: { subject: null, body: '{{practice_name}}: Your refill was approved and sent to your pharmacy. Reply STOP to opt out.' },
    [P]: { subject: 'Refill approved: {{medication_name}}', body: 'Sent to {{pharmacy}}. {{response_note}}' },
  },
  [NotificationType.RefillDenied]: {
    [E]: { subject: 'An update on your refill request', body: `Hi {{patient_first_name}},\n\nYour doctor reviewed your refill request. Please sign in to the patient portal to see their note: {{portal_link}}${SIGN_OFF}` },
    [P]: { subject: 'Refill not approved: {{medication_name}}', body: '{{response_note}}' },
  },
  [NotificationType.MessageReceived]: {
    [P]: { subject: 'New reply: {{message_subject}}', body: 'Your care team replied to your message.' },
    [E]: { subject: 'You have a new message from {{practice_name}}', body: `Hi {{patient_first_name}},\n\nYour care team replied to your message. Sign in to read it securely: {{portal_link}}${SIGN_OFF}` },
  },
  [NotificationType.ProfileUpdateReviewed]: {
    [P]: { subject: 'Your profile update was {{review_status}}', body: '{{response_note}}' },
  },
};

// ── Templates ─────────────────────────────────────────────────────────────────
const FIELD = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** Replaces {{merge_fields}}; unknown or missing values render as empty text. */
export function renderTemplate(text: string, values: Partial<Record<MergeField, string | null | undefined>>): string {
  return text
    .replace(FIELD, (_, name: string) => values[name as MergeField] ?? '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** Problems with a template: unknown merge fields or stray braces. */
export function templateErrors(text: string, allowed: ReadonlyArray<MergeField>): string[] {
  const errors: string[] = [];
  const used = [...text.matchAll(FIELD)].map(m => m[1]);
  const unknown = [...new Set(used.filter(f => !allowed.includes(f as MergeField)))];
  if (unknown.length) errors.push(`Unknown merge field${unknown.length > 1 ? 's' : ''}: ${unknown.map(f => `{{${f}}}`).join(', ')}`);
  if (text.replace(FIELD, '').match(/\{\{|\}\}/)) errors.push('Check the braces: merge fields look like {{patient_first_name}}.');
  return errors;
}

export function sampleValues(): Record<MergeField, string> {
  return Object.fromEntries(Object.entries(MERGE_FIELDS).map(([k, v]) => [k, v.example])) as Record<MergeField, string>;
}

/** Standard SMS segments (GSM-7: 160 chars, 153 per segment when split). */
export function smsSegments(text: string): number {
  return text.length <= 160 ? 1 : Math.ceil(text.length / 153);
}

// ── Scheduling & delivery rules ───────────────────────────────────────────────
export const REMINDERS: ReadonlyArray<{ type: NotificationType; hoursBefore: number }> = [
  { type: NotificationType.AppointmentReminder48h, hoursBefore: 48 },
  { type: NotificationType.AppointmentReminder2h, hoursBefore: 2 },
];

/** Reminders still worth sending for a visit (a booking made 30h ahead gets only the 2h reminder). */
export function reminderSchedule(slotStart: Date, now: Date = new Date()): Array<{ type: NotificationType; sendAt: Date }> {
  return REMINDERS
    .map(r => ({ type: r.type, sendAt: new Date(slotStart.getTime() - r.hoursBefore * 3_600_000) }))
    .filter(r => r.sendAt > now);
}

export const STATEMENT_REMINDERS: ReadonlyArray<{ type: NotificationType; daysOverdue: number }> = [
  { type: NotificationType.StatementReminder30d, daysOverdue: 30 },
  { type: NotificationType.StatementReminder60d, daysOverdue: 60 },
];

export const MAX_DELIVERY_ATTEMPTS = 5;

/** Exponential backoff between delivery attempts: 1, 2, 4, 8 … minutes, capped at 1 hour. */
export function retryDelayMs(attempts: number): number {
  return Math.min(2 ** Math.max(attempts - 1, 0), 60) * 60_000;
}

// ── Read models ───────────────────────────────────────────────────────────────
export interface NotificationLogEntry {
  readonly id: string;
  readonly type: NotificationType;
  readonly typeLabel: string;
  readonly channel: NotificationChannel;
  readonly patientId: string | null;
  readonly patientName?: string;
  readonly appointmentId: string | null;
  readonly relatedType: string | null;
  readonly relatedId: string | null;
  readonly recipient: string | null;
  readonly subject: string | null;
  readonly body: string;
  readonly status: NotificationStatus;
  readonly statusReason: string | null;
  readonly scheduledFor: Date;
  readonly sentAt: Date | null;
  readonly attempts: number;
  readonly lastError: string | null;
  readonly provider: string | null;
  readonly createdAt: Date;
}

export interface PortalNotification {
  readonly id: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  /** Portal route to open. */
  readonly link: string | null;
  readonly createdAt: Date;
  readonly read: boolean;
}

export interface StaffNotificationItem {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly body: string;
  readonly link: string | null;
  readonly createdAt: Date;
  readonly read: boolean;
}

export interface TemplateView extends TemplateContent {
  readonly type: NotificationType;
  readonly channel: NotificationChannel;
  readonly isCustom: boolean;
  readonly isActive: boolean;
  readonly updatedAt: Date | null;
  readonly updatedByName: string | null;
}
