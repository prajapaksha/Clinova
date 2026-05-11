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
