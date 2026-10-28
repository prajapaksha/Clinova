// ── Enums ─────────────────────────────────────────────────────────────────────
export enum ReportType {
  DailySchedule = 'DAILY_SCHEDULE',
  Revenue = 'REVENUE',
  AccountsReceivableAging = 'AR_AGING',
  PatientDemographics = 'PATIENT_DEMOGRAPHICS',
  AppointmentAnalytics = 'APPOINTMENT_ANALYTICS',
  ProviderProductivity = 'PROVIDER_PRODUCTIVITY',
  OutstandingTasks = 'OUTSTANDING_TASKS',
}

export enum ExportFormat {
  CSV = 'CSV',
  PDF = 'PDF',
  Excel = 'EXCEL',
}

export enum DateRangePreset {
  Today = 'TODAY',
  Yesterday = 'YESTERDAY',
  ThisWeek = 'THIS_WEEK',
  LastWeek = 'LAST_WEEK',
  ThisMonth = 'THIS_MONTH',
  LastMonth = 'LAST_MONTH',
  Last30Days = 'LAST_30_DAYS',
  Last90Days = 'LAST_90_DAYS',
  ThisYear = 'THIS_YEAR',
  Custom = 'CUSTOM',
}

export enum GroupBy {
  Day = 'DAY',
  Week = 'WEEK',
  Month = 'MONTH',
  Provider = 'PROVIDER',
  ServiceType = 'SERVICE_TYPE',
  Payer = 'PAYER',
}

// ── Value Objects ─────────────────────────────────────────────────────────────
export interface DateRange {
  readonly from: Date;
  readonly to: Date;
}

export interface ReportFilter {
  readonly reportType: ReportType;
  readonly dateRange: DateRange;
  readonly providerId?: string;
  readonly locationId?: string;
  readonly groupBy?: GroupBy;
}

// ── Report Result Types ────────────────────────────────────────────────────────
export interface KpiSummary {
  readonly totalAppointmentsToday: number;
  readonly patientsCheckedIn: number;
  readonly unsignedNotes: number;
  readonly outstandingInvoicesCents: number;
  readonly noShowRate: number;
  readonly revenueThisMonthCents: number;
}

export interface AgingBucket {
  readonly label: string;
  readonly daysFrom: number;
  readonly daysTo: number | null;
  readonly totalCents: number;
  readonly invoiceCount: number;
}

export interface DailyScheduleReport {
  readonly date: Date;
  readonly providerId: string;
  readonly providerName: string;
  readonly totalAppointments: number;
  readonly confirmedCount: number;
  readonly completedCount: number;
  readonly cancelledCount: number;
  readonly noShowCount: number;
  readonly expectedRevenueCents: number;
}

export interface RevenueReport {
  readonly period: string;
  readonly groupValue: string;
  readonly totalRevenueCents: number;
  readonly collectedCents: number;
  readonly adjustmentsCents: number;
  readonly outstandingCents: number;
  readonly encounterCount: number;
}

export interface ArAgingReport {
  readonly asOfDate: Date;
  readonly buckets: ReadonlyArray<AgingBucket>;
  readonly totalOutstandingCents: number;
  readonly patientCount: number;
}

export interface AppointmentAnalyticsReport {
  readonly period: string;
  readonly totalAppointments: number;
  readonly cancellationRate: number;
  readonly noShowRate: number;
  readonly averageWaitTimeMinutes: number;
  readonly averageEncounterDurationMinutes: number;
}

export interface ProviderProductivityReport {
  readonly providerId: string;
  readonly providerName: string;
  readonly period: string;
  readonly encounterCount: number;
  readonly averageEncounterDurationMinutes: number;
  readonly revenueCents: number;
  readonly unsignedNoteCount: number;
}

export interface OutstandingTasksReport {
  readonly unsignedEncounters: number;
  readonly unbilledEncounters: number;
  readonly pendingClaims: number;
  readonly overdueInvoices: number;
  readonly expiringCredentials: number;
}

// -- Dashboard (role-aware home) -----------------------------------------------
export type DashboardScope = 'PRACTICE' | 'PROVIDER';

export interface DashboardKpis {
  /** Appointments today, excluding cancelled/rescheduled. */
  readonly appointmentsToday: number;
  /** Same weekday last week, for the trend indicator. */
  readonly appointmentsLastWeek: number;
  /** Patients who have arrived (checked in, in progress, or completed). */
  readonly arrived: number;
  /** Checked in and waiting to be seen. */
  readonly waitingNow: number;
  readonly noShowsToday: number;
  /** Null when the user's role cannot see clinical notes. */
  readonly unsignedNotes: number | null;
  readonly unsignedOverdue: number | null;
  /** No-show rate over the last 30 days (0�1); null when there is no history. */
  readonly noShowRate30d: number | null;
}

export interface RosterEntry {
  readonly appointmentId: string;
  readonly start: string;
  readonly end: string;
  readonly patientId: string;
  readonly patientName: string;
  readonly patientMrn: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly typeName: string;
  readonly typeColor: string;
  readonly status: string;
  readonly reasonForVisit: string | null;
  readonly checkedInAt: string | null;
  readonly hasCriticalAlert: boolean;
}

export type DashboardAlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type DashboardAlertKind = 'PATIENT_ALERT' | 'LONG_WAIT' | 'UNSIGNED_NOTES' | 'NO_SHOW';

export interface DashboardAlert {
  readonly id: string;
  readonly kind: DashboardAlertKind;
  readonly severity: DashboardAlertSeverity;
  readonly title: string;
  readonly detail: string;
  /** Router commands for the alert's call to action. */
  readonly link: ReadonlyArray<string>;
  readonly queryParams?: Readonly<Record<string, string>>;
  readonly actionLabel: string;
}

export interface DailyVolume {
  /** Local calendar date, YYYY-MM-DD. */
  readonly date: string;
  readonly count: number;
}

export interface DashboardSummary {
  readonly date: string;
  readonly scope: DashboardScope;
  readonly providerId: string | null;
  readonly kpis: DashboardKpis;
  readonly roster: ReadonlyArray<RosterEntry>;
  readonly alerts: ReadonlyArray<DashboardAlert>;
  readonly weeklyVolume: ReadonlyArray<DailyVolume>;
  /** Busiest two-hour window over the last 7 days, as local hours [start, end). */
  readonly peakHours: { readonly start: number; readonly end: number } | null;
  readonly generatedAt: string;
}

/** Target from PRD �2.3 KPIs. */
export const NO_SHOW_RATE_TARGET = 0.08;
/** Minutes after check-in before a waiting patient raises an alert. */
export const LONG_WAIT_MINUTES = 20;
/** Hours after which an unsigned note is considered overdue. */
export const UNSIGNED_NOTE_OVERDUE_HOURS = 24;

const SEVERITY_ORDER: Record<DashboardAlertSeverity, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };

export function sortAlerts<T extends Pick<DashboardAlert, 'severity'>>(alerts: ReadonlyArray<T>): T[] {
  return [...alerts].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/** Percentage change, rounded; null when there is no baseline. */
export function trendPercent(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Finds the busiest window of `width` consecutive hours from a list of local start hours. */
export function peakWindow(hours: ReadonlyArray<number>, width = 2): { start: number; end: number } | null {
  if (hours.length === 0) return null;
  const counts = new Array(24).fill(0) as number[];
  hours.forEach(h => { if (h >= 0 && h < 24) counts[h]++; });
  let best = -1;
  let bestStart = 0;
  for (let start = 0; start <= 24 - width; start++) {
    const total = counts.slice(start, start + width).reduce((a, b) => a + b, 0);
    if (total > best) { best = total; bestStart = start; }
  }
  return { start: bestStart, end: bestStart + width };
}

export function formatHourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12}${suffix}`;
}