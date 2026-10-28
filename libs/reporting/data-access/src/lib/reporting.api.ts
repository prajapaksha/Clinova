import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  KpiSummary, DailyScheduleReport, RevenueReport,
  ArAgingReport, AppointmentAnalyticsReport,
  ProviderProductivityReport, OutstandingTasksReport,
  ReportFilter, ExportFormat, DashboardSummary,
} from '@clinova/reporting/domain';

/** Formats a Date as the browser's local calendar date (YYYY-MM-DD). */
export function toLocalDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function filterToParams(filter: ReportFilter): Record<string, string> {
  const p: Record<string, string> = {
    from: filter.dateRange.from.toISOString(),
    to: filter.dateRange.to.toISOString(),
  };
  if (filter.providerId) p['providerId'] = filter.providerId;
  if (filter.locationId) p['locationId'] = filter.locationId;
  if (filter.groupBy) p['groupBy'] = filter.groupBy;
  return p;
}

@Injectable({ providedIn: 'root' })
export class ReportingApiService {
  private readonly http = inject(HttpClient);

  /** Staff home dashboard for the browser's local day. */
  getDashboard(date: Date, providerId?: string): Observable<DashboardSummary> {
    const params: Record<string, string> = {
      date: toLocalDateKey(date),
      tzOffset: String(date.getTimezoneOffset()),
    };
    if (providerId) params['providerId'] = providerId;
    return this.http.get<DashboardSummary>('/api/dashboard', { params });
  }

  getKpiSummary(): Observable<KpiSummary> {
    return this.http.get<KpiSummary>('/api/reports/kpi');
  }

  getDailySchedule(filter: ReportFilter): Observable<DailyScheduleReport[]> {
    return this.http.get<DailyScheduleReport[]>('/api/reports/daily-schedule', { params: filterToParams(filter) });
  }

  getRevenue(filter: ReportFilter): Observable<RevenueReport[]> {
    return this.http.get<RevenueReport[]>('/api/reports/revenue', { params: filterToParams(filter) });
  }

  getArAging(): Observable<ArAgingReport> {
    return this.http.get<ArAgingReport>('/api/reports/ar-aging');
  }

  getAppointmentAnalytics(filter: ReportFilter): Observable<AppointmentAnalyticsReport[]> {
    return this.http.get<AppointmentAnalyticsReport[]>('/api/reports/appointment-analytics', { params: filterToParams(filter) });
  }

  getProviderProductivity(filter: ReportFilter): Observable<ProviderProductivityReport[]> {
    return this.http.get<ProviderProductivityReport[]>('/api/reports/provider-productivity', { params: filterToParams(filter) });
  }

  getOutstandingTasks(): Observable<OutstandingTasksReport> {
    return this.http.get<OutstandingTasksReport>('/api/reports/outstanding-tasks');
  }

  export(filter: ReportFilter, format: ExportFormat): Observable<Blob> {
    return this.http.get('/api/reports/export', {
      params: { ...filterToParams(filter), format },
      responseType: 'blob',
    });
  }
}
