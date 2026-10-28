import type { DaySchedule } from '@clinova/staff/domain';

// ── Branded IDs ───────────────────────────────────────────────────────────────
export type PatientAccountId = string & { readonly _brand: 'PatientAccountId' };
export type ThreadId = string & { readonly _brand: 'ThreadId' };

// ── Accounts ──────────────────────────────────────────────────────────────────
export enum PortalAccountStatus {
  Invited = 'INVITED',
  Active = 'ACTIVE',
  Disabled = 'DISABLED',
}

/** PRD §5.1: patients are signed out after 30 minutes of inactivity. */
export const PATIENT_IDLE_TIMEOUT_MINUTES = 30;
export const INVITE_VALID_DAYS = 14;
export const RESET_TOKEN_VALID_MINUTES = 60;

/** The signed-in patient (returned by /portal/auth/me). */
export interface PortalUser {
  readonly id: PatientAccountId;
  readonly patientId: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly preferredName: string | null;
  readonly lastLoginAt: Date | null;
}

/** Portal access as seen by staff on the patient profile. */
export interface PortalAccessSummary {
  readonly status: PortalAccountStatus | 'NONE';
  readonly email: string | null;
  readonly inviteExpiresAt: Date | null;
  readonly activatedAt: Date | null;
  readonly lastLoginAt: Date | null;
  readonly lockedUntil: Date | null;
}

/** Formats an invite code for display: K7QM3XPA → K7QM-3XPA. */
export function formatInviteCode(code: string): string {
  const clean = normalizeInviteCode(code);
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

export function normalizeInviteCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ── Notification preferences (PRD §4.6) ───────────────────────────────────────
export type NotificationTopic = 'appointmentReminders' | 'appointmentChanges' | 'billing' | 'documents' | 'results' | 'messages';
export type NotificationChannel = 'email' | 'sms';
export type NotificationPreferences = Readonly<Record<NotificationTopic, Readonly<Record<NotificationChannel, boolean>>>>;

export const NOTIFICATION_TOPICS: ReadonlyArray<{ key: NotificationTopic; label: string; description: string }> = [
  { key: 'appointmentReminders', label: 'Appointment reminders', description: '48 hours and 2 hours before each visit.' },
  { key: 'appointmentChanges', label: 'Booking changes', description: 'Confirmations, reschedules and cancellations.' },
  { key: 'billing', label: 'Bills & receipts', description: 'New statements, payment receipts and reminders.' },
  { key: 'documents', label: 'New documents', description: 'When the practice shares a document with you.' },
  { key: 'results', label: 'Test results', description: 'When your doctor releases a result.' },
  { key: 'messages', label: 'Messages', description: 'Replies from your care team.' },
];

export function defaultNotificationPreferences(): NotificationPreferences {
  const on = { email: true, sms: false };
  return {
    appointmentReminders: { email: true, sms: true },
    appointmentChanges: { email: true, sms: true },
    billing: on,
    documents: on,
    results: on,
    messages: on,
  };
}

/** Fills in missing topics/channels from the defaults (stored preferences may predate new topics). */
export function normalizePreferences(stored: unknown): NotificationPreferences {
  const defaults = defaultNotificationPreferences();
  const input = (stored && typeof stored === 'object' ? stored : {}) as Record<string, Record<string, unknown>>;
  const result = {} as Record<NotificationTopic, Record<NotificationChannel, boolean>>;
  for (const { key } of NOTIFICATION_TOPICS) {
    result[key] = {
      email: typeof input[key]?.['email'] === 'boolean' ? (input[key]['email'] as boolean) : defaults[key].email,
      sms: typeof input[key]?.['sms'] === 'boolean' ? (input[key]['sms'] as boolean) : defaults[key].sms,
    };
  }
  return result;
}

// ── Self-scheduling (PRD §4.2, §4.8) ─────────────────────────────────────────
/** Practice policy: changes must be made at least this long before the visit. */
export const CANCELLATION_CUTOFF_HOURS = 24;
export const MIN_BOOKING_LEAD_HOURS = 2;
export const MAX_ADVANCE_BOOKING_DAYS = 60;

export interface TimeWindow {
  readonly start: Date;
  readonly end: Date;
}

export interface BookableType {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly durationMinutes: number;
}

export interface PortalProvider {
  readonly id: string;
  readonly displayName: string;
  readonly title: string | null;
  readonly specialties: ReadonlyArray<string>;
  readonly bio: string | null;
  readonly officeLocation: string | null;
  /** Seen this patient before. */
  readonly isMyProvider: boolean;
}

export interface AvailabilityDay {
  /** Local YYYY-MM-DD. */
  readonly date: string;
  readonly slots: ReadonlyArray<TimeWindow>;
}

const MINUTE = 60_000;

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Working windows for one local day, as UTC instants, with the lunch break removed.
 * @param localMidnight UTC instant of local midnight for the day.
 */
export function workingWindows(day: DaySchedule | undefined, localMidnight: Date): TimeWindow[] {
  if (!day?.isWorking || !day.hours) return [];
  const at = (hhmm: string) => new Date(localMidnight.getTime() + minutesOf(hhmm) * MINUTE);
  const start = at(day.hours.start);
  const end = at(day.hours.end);
  if (!day.lunchBreak) return [{ start, end }];
  const lunchStart = at(day.lunchBreak.start);
  const lunchEnd = at(day.lunchBreak.end);
  return [{ start, end: lunchStart }, { start: lunchEnd, end }].filter(w => w.end > w.start);
}

export interface SlotQuery {
  readonly windows: ReadonlyArray<TimeWindow>;
  /** Existing appointments (and any other blocked time) for the provider. */
  readonly busy: ReadonlyArray<TimeWindow>;
  readonly durationMinutes: number;
  /** Gap kept free after each existing appointment. */
  readonly bufferMinutes?: number;
  readonly stepMinutes?: number;
  readonly now: Date;
  readonly minLeadMinutes?: number;
}

/** Bookable start times inside the windows that don't overlap busy time (PRD: real-time availability). */
export function availableSlots(q: SlotQuery): TimeWindow[] {
  const duration = q.durationMinutes * MINUTE;
  const step = (q.stepMinutes ?? Math.min(30, q.durationMinutes)) * MINUTE;
  const buffer = (q.bufferMinutes ?? 0) * MINUTE;
  const earliest = q.now.getTime() + (q.minLeadMinutes ?? MIN_BOOKING_LEAD_HOURS * 60) * MINUTE;
  const busy = q.busy.map(b => ({ start: b.start.getTime(), end: b.end.getTime() + buffer }));
  const slots: TimeWindow[] = [];
  for (const w of q.windows) {
    for (let t = w.start.getTime(); t + duration <= w.end.getTime(); t += step) {
      if (t < earliest) continue;
      const end = t + duration;
      if (busy.some(b => b.start < end && b.end > t)) continue;
      slots.push({ start: new Date(t), end: new Date(end) });
    }
  }
  return slots;
}

/** Patients may reschedule or cancel online until the practice cutoff. */
export function canChangeOnline(slotStart: Date | string, now: Date = new Date(), cutoffHours = CANCELLATION_CUTOFF_HOURS): boolean {
  return new Date(slotStart).getTime() - now.getTime() >= cutoffHours * 3_600_000;
}

export interface PortalAppointment {
  readonly id: string;
  readonly start: Date;
  readonly end: Date;
  readonly status: string;
  readonly typeId: string;
  readonly typeName: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly reasonForVisit: string | null;
  readonly location: string | null;
  /** Reschedule/cancel online is allowed (upcoming, not checked in, outside the cutoff). */
  readonly canChange: boolean;
  /** Signed visit summary available. */
  readonly visitSummaryId: string | null;
}

// ── Health records ────────────────────────────────────────────────────────────
export interface VisitSummaryListItem {
  readonly id: string;
  readonly date: Date;
  readonly providerName: string;
  readonly reasonForVisit: string | null;
  readonly primaryDiagnosis: string | null;
}

/** Patient-friendly summary of a signed encounter (no internal clinical reasoning). */
export interface VisitSummary extends VisitSummaryListItem {
  readonly diagnoses: ReadonlyArray<{ code: string; description: string }>;
  readonly vitals: ReadonlyArray<{ label: string; value: string }>;
  readonly treatmentPlan: string | null;
  readonly patientInstructions: string | null;
  readonly followUpInstructions: string | null;
  readonly prescriptions: ReadonlyArray<{ name: string; directions: string; refills: number }>;
  readonly signedAt: Date | null;
  readonly signedByName: string | null;
}

export interface PortalMedication {
  /** Set for prescriptions issued by the practice (refills can be requested). */
  readonly prescriptionId: string | null;
  readonly name: string;
  readonly directions: string | null;
  readonly prescriberName: string | null;
  readonly issuedAt: Date | null;
  readonly refillsRemaining: number | null;
  readonly pendingRefill: boolean;
}

export interface PortalDocument {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly isResult: boolean;
  readonly sharedAt: Date;
  readonly sharedByName: string | null;
  /** Doctor's note released with a result. */
  readonly note: string | null;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly isNew: boolean;
}

export interface HealthSummary {
  readonly allergies: ReadonlyArray<{ allergen: string; reaction: string; severity: string }>;
  readonly conditions: ReadonlyArray<string>;
  readonly medications: ReadonlyArray<PortalMedication>;
  readonly immunizations: ReadonlyArray<string>;
}

// ── Refills ───────────────────────────────────────────────────────────────────
export enum RefillStatus {
  Pending = 'PENDING',
  Approved = 'APPROVED',
  Denied = 'DENIED',
}

export interface RefillRequest {
  readonly id: string;
  readonly patientId: string;
  readonly patientName?: string;
  readonly prescriptionId: string;
  readonly medicationName: string;
  readonly prescriberName: string | null;
  readonly refillsRemaining: number;
  readonly pharmacy: string | null;
  readonly note: string | null;
  readonly status: RefillStatus;
  readonly responseNote: string | null;
  readonly respondedByName: string | null;
  readonly respondedAt: Date | null;
  readonly createdAt: Date;
}

// ── Messaging ─────────────────────────────────────────────────────────────────
export enum ThreadCategory {
  General = 'GENERAL',
  Appointment = 'APPOINTMENT',
  Billing = 'BILLING',
  Prescription = 'PRESCRIPTION',
  Results = 'RESULTS',
}

export const THREAD_CATEGORY_LABELS: Readonly<Record<ThreadCategory, string>> = {
  [ThreadCategory.General]: 'General question',
  [ThreadCategory.Appointment]: 'Appointments',
  [ThreadCategory.Billing]: 'Billing',
  [ThreadCategory.Prescription]: 'Prescriptions',
  [ThreadCategory.Results]: 'Test results',
};

export const URGENT_DISCLAIMER =
  'Messages are for non-urgent questions and are usually answered within 2 business days. ' +
  'If this is an emergency, call 911. For urgent concerns, call the office.';

export interface ThreadMessage {
  readonly id: string;
  readonly authorType: 'PATIENT' | 'STAFF';
  readonly authorName: string;
  readonly body: string;
  readonly createdAt: Date;
}

export interface ThreadSummary {
  readonly id: ThreadId;
  readonly patientId: string;
  readonly patientName?: string;
  readonly patientMrn?: string;
  readonly subject: string;
  readonly category: ThreadCategory;
  readonly status: 'OPEN' | 'CLOSED';
  readonly lastMessageAt: Date;
  readonly lastMessagePreview: string;
  readonly lastAuthorType: 'PATIENT' | 'STAFF';
  /** Unread for whoever is asking (patient or staff). */
  readonly unread: boolean;
  readonly messageCount: number;
}

export interface Thread extends ThreadSummary {
  readonly messages: ReadonlyArray<ThreadMessage>;
}

// ── Profile change requests ───────────────────────────────────────────────────
export enum ChangeRequestStatus {
  Pending = 'PENDING',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
}

/** Fields patients may request to change; staff review before they apply (PRD §4.8). */
export const PROFILE_CHANGE_FIELDS = ['preferredName', 'pronouns', 'preferredLanguage', 'contact', 'emergencyContacts', 'insurancePolicies'] as const;
export type ProfileChangeField = (typeof PROFILE_CHANGE_FIELDS)[number];

export const PROFILE_FIELD_LABELS: Readonly<Record<ProfileChangeField, string>> = {
  preferredName: 'Preferred name',
  pronouns: 'Pronouns',
  preferredLanguage: 'Preferred language',
  contact: 'Contact details & address',
  emergencyContacts: 'Emergency contacts',
  insurancePolicies: 'Insurance',
};

export interface ProfileChangeRequest {
  readonly id: string;
  readonly patientId: string;
  readonly patientName?: string;
  readonly patientMrn?: string;
  readonly changes: Readonly<Partial<Record<ProfileChangeField, { readonly old: unknown; readonly new: unknown }>>>;
  readonly status: ChangeRequestStatus;
  readonly reviewedByName: string | null;
  readonly reviewedAt: Date | null;
  readonly rejectionReason: string | null;
  readonly createdAt: Date;
}

/** Only the fields whose value actually differs. */
export function diffProfile(current: Record<string, unknown>, proposed: Record<string, unknown>): Partial<Record<ProfileChangeField, { old: unknown; new: unknown }>> {
  const changes: Partial<Record<ProfileChangeField, { old: unknown; new: unknown }>> = {};
  for (const field of PROFILE_CHANGE_FIELDS) {
    if (!(field in proposed)) continue;
    const before = current[field] ?? null;
    const after = proposed[field] ?? null;
    if (JSON.stringify(before) !== JSON.stringify(after)) changes[field] = { old: before, new: after };
  }
  return changes;
}

// ── Payments ──────────────────────────────────────────────────────────────────
export type CardBrand = 'Visa' | 'Mastercard' | 'American Express' | 'Discover' | 'Card';

export interface SavedCard {
  readonly id: string;
  readonly brand: CardBrand;
  readonly last4: string;
  readonly expMonth: number;
  readonly expYear: number;
  readonly cardholderName: string;
  readonly isDefault: boolean;
  readonly isExpired: boolean;
}

export function cardDigits(number: string): string {
  return number.replace(/\D/g, '');
}

export function cardBrand(number: string): CardBrand {
  const n = cardDigits(number);
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'American Express';
  if (/^6(011|5)/.test(n)) return 'Discover';
  return 'Card';
}

/** Luhn checksum. */
export function isValidCardNumber(number: string): boolean {
  const n = cardDigits(number);
  if (n.length < 13 || n.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Cards are valid through the last day of the expiry month. */
export function isCardExpired(expMonth: number, expYear: number, now: Date = new Date()): boolean {
  const year = expYear < 100 ? 2000 + expYear : expYear;
  return year < now.getFullYear() || (year === now.getFullYear() && expMonth < now.getMonth() + 1);
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export interface PortalDashboard {
  readonly greetingName: string;
  readonly nextAppointment: PortalAppointment | null;
  readonly upcomingCount: number;
  readonly balanceCents: number;
  readonly openInvoiceCount: number;
  readonly oldestDueDate: Date | null;
  readonly unreadMessages: number;
  readonly newDocuments: ReadonlyArray<PortalDocument>;
  readonly pendingRequests: number;
}
