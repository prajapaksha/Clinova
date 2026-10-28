import { Injectable } from '@nestjs/common';
import type { AppointmentType } from '@prisma/client';
import type {
  DailyVolume,
  DashboardAlert,
  DashboardKpis,
  DashboardSummary,
  RosterEntry,
} from '@clinova/reporting/domain';
import {
  LONG_WAIT_MINUTES,
  UNSIGNED_NOTE_OVERDUE_HOURS,
  peakWindow,
  sortAlerts,
} from '@clinova/reporting/domain';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../auth/auth.service';
import { LocalClock } from '../common/local-clock';

export interface DashboardQuery {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** Minutes behind UTC, as returned by `Date.prototype.getTimezoneOffset()`. */
  tzOffset: number;
  providerId?: string;
}

const CLINICAL_ROLES = ['PHYSICIAN', 'NURSE', 'ADMIN'];
const NOT_SCHEDULED = ['CANCELLED', 'RESCHEDULED'];
const ARRIVED = ['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'];
const UNSIGNED = ['DRAFT', 'IN_PROGRESS'];
const DAY_MS = 86_400_000;

interface PatientFlags {
  name: string;
  mrn: string;
  criticalMessages: string[];
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(query: DashboardQuery, user: AuthUser, now = new Date()): Promise<DashboardSummary> {
    const clock = new LocalClock(query.tzOffset);
    const dayStart = clock.midnight(query.date);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    const weekStart = new Date(dayStart.getTime() - 6 * DAY_MS);
    const providerFilter = query.providerId ? { providerId: query.providerId } : {};
    const canSeeClinical = CLINICAL_ROLES.includes(user.role);

    const [today, lastWeekCount, week, history30d, unsigned] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { ...providerFilter, slotStart: { gte: dayStart, lt: dayEnd } },
        include: { appointmentType: true },
        orderBy: { slotStart: 'asc' },
      }),
      this.prisma.appointment.count({
        where: {
          ...providerFilter,
          status: { notIn: NOT_SCHEDULED },
          slotStart: { gte: new Date(dayStart.getTime() - 7 * DAY_MS), lt: new Date(dayEnd.getTime() - 7 * DAY_MS) },
        },
      }),
      this.prisma.appointment.findMany({
        where: { ...providerFilter, status: { notIn: NOT_SCHEDULED }, slotStart: { gte: weekStart, lt: dayEnd } },
        select: { slotStart: true },
      }),
      this.prisma.appointment.groupBy({
        by: ['status'],
        where: {
          ...providerFilter,
          status: { in: ['COMPLETED', 'NO_SHOW'] },
          slotStart: { gte: new Date(now.getTime() - 30 * DAY_MS), lt: now },
        },
        _count: { _all: true },
      }),
      canSeeClinical
        ? this.prisma.encounter.findMany({
            where: { ...providerFilter, status: { in: UNSIGNED } },
            select: { createdAt: true },
          })
        : Promise.resolve(null),
    ]);

    const scheduled = today.filter(a => !NOT_SCHEDULED.includes(a.status));
    const patients = await this.patientFlags([...new Set(scheduled.map(a => a.patientId))]);
    const providers = await this.providerNames([...new Set(scheduled.map(a => a.providerId))]);

    const roster: RosterEntry[] = scheduled.map(a => {
      const patient = patients.get(a.patientId);
      const type = (a as typeof a & { appointmentType: AppointmentType }).appointmentType;
      return {
        appointmentId: a.id,
        start: a.slotStart.toISOString(),
        end: a.slotEnd.toISOString(),
        patientId: a.patientId,
        patientName: patient?.name ?? 'Unknown patient',
        patientMrn: patient?.mrn ?? '',
        providerId: a.providerId,
        providerName: providers.get(a.providerId) ?? 'Unassigned',
        typeName: type?.name ?? 'Appointment',
        typeColor: type?.color ?? '#9e9e9e',
        status: a.status,
        reasonForVisit: a.reasonForVisit,
        checkedInAt: a.checkedInAt?.toISOString() ?? null,
        hasCriticalAlert: (patient?.criticalMessages.length ?? 0) > 0,
      };
    });

    const overdueCutoff = now.getTime() - UNSIGNED_NOTE_OVERDUE_HOURS * 3_600_000;
    const historyCount = (status: string) => history30d.find(h => h.status === status)?._count._all ?? 0;
    const noShows30 = historyCount('NO_SHOW');
    const completed30 = historyCount('COMPLETED');

    const kpis: DashboardKpis = {
      appointmentsToday: scheduled.length,
      appointmentsLastWeek: lastWeekCount,
      arrived: scheduled.filter(a => ARRIVED.includes(a.status)).length,
      waitingNow: scheduled.filter(a => a.status === 'CHECKED_IN').length,
      noShowsToday: scheduled.filter(a => a.status === 'NO_SHOW').length,
      unsignedNotes: unsigned ? unsigned.length : null,
      unsignedOverdue: unsigned ? unsigned.filter(e => e.createdAt.getTime() < overdueCutoff).length : null,
      noShowRate30d: noShows30 + completed30 > 0 ? noShows30 / (noShows30 + completed30) : null,
    };

    const weeklyVolume: DailyVolume[] = Array.from({ length: 7 }, (_, i) => {
      const key = clock.dateKey(new Date(weekStart.getTime() + i * DAY_MS + 12 * 3_600_000));
      return { date: key, count: week.filter(a => clock.dateKey(a.slotStart) === key).length };
    });

    return {
      date: query.date,
      scope: query.providerId ? 'PROVIDER' : 'PRACTICE',
      providerId: query.providerId ?? null,
      kpis,
      roster,
      alerts: sortAlerts(this.buildAlerts(roster, patients, kpis, clock, now, canSeeClinical)),
      weeklyVolume,
      peakHours: peakWindow(week.map(a => clock.hour(a.slotStart))),
      generatedAt: now.toISOString(),
    };
  }

  private buildAlerts(
    roster: RosterEntry[],
    patients: Map<string, PatientFlags>,
    kpis: DashboardKpis,
    clock: LocalClock,
    now: Date,
    canSeeClinical: boolean,
  ): DashboardAlert[] {
    const alerts: DashboardAlert[] = [];

    for (const r of roster) {
      const flags = patients.get(r.patientId);
      const start = new Date(r.start);

      if (flags?.criticalMessages.length && !['COMPLETED', 'NO_SHOW'].includes(r.status)) {
        alerts.push({
          id: `critical-${r.appointmentId}`,
          kind: 'PATIENT_ALERT',
          severity: 'CRITICAL',
          title: `${r.patientName} · ${clock.time(start)}`,
          detail: flags.criticalMessages.join(' • '),
          link: ['/patients', r.patientId, 'summary'],
          actionLabel: 'Open chart',
        });
      }

      if (r.status === 'CHECKED_IN' && r.checkedInAt) {
        const waited = Math.floor((now.getTime() - new Date(r.checkedInAt).getTime()) / 60_000);
        if (waited >= LONG_WAIT_MINUTES) {
          alerts.push({
            id: `wait-${r.appointmentId}`,
            kind: 'LONG_WAIT',
            severity: 'WARNING',
            title: `Waiting ${formatDuration(waited)}`,
            detail: `${r.patientName} checked in at ${clock.time(new Date(r.checkedInAt))} for ${r.providerName}.`,
            ...(canSeeClinical
              ? {
                  link: ['/encounters/new'],
                  queryParams: { appointmentId: r.appointmentId, patientId: r.patientId },
                  actionLabel: 'Begin encounter',
                }
              : { link: ['/calendar'], actionLabel: 'View schedule' }),
          });
        }
      }

      if (r.status === 'NO_SHOW') {
        alerts.push({
          id: `noshow-${r.appointmentId}`,
          kind: 'NO_SHOW',
          severity: 'INFO',
          title: `No-show · ${clock.time(start)}`,
          detail: `${r.patientName} missed their ${r.typeName.toLowerCase()} with ${r.providerName}.`,
          link: ['/patients', r.patientId, 'appointments'],
          actionLabel: 'Reschedule',
        });
      }
    }

    if (kpis.unsignedOverdue) {
      const n = kpis.unsignedOverdue;
      alerts.push({
        id: 'unsigned-overdue',
        kind: 'UNSIGNED_NOTES',
        severity: 'WARNING',
        title: `${n} note${n > 1 ? 's' : ''} unsigned for over ${UNSIGNED_NOTE_OVERDUE_HOURS} hours`,
        detail: 'Unsigned notes delay billing and must be completed by the treating physician.',
        link: ['/encounters'],
        actionLabel: 'Review notes',
      });
    }

    return alerts;
  }

  private async patientFlags(ids: string[]): Promise<Map<string, PatientFlags>> {
    if (!ids.length) return new Map();
    const rows = await this.prisma.patient.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, mrn: true, alertsJson: true },
    });
    return new Map(rows.map(p => {
      const alerts = JSON.parse(p.alertsJson) as Array<{ severity: string; message: string; isActive: boolean }>;
      return [p.id, {
        name: `${p.firstName} ${p.lastName}`,
        mrn: p.mrn,
        criticalMessages: alerts.filter(a => a.isActive && a.severity === 'CRITICAL').map(a => a.message),
      }];
    }));
  }

  private async providerNames(ids: string[]): Promise<Map<string, string>> {
    if (!ids.length) return new Map();
    const rows = await this.prisma.staff.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, lastName: true, role: true },
    });
    return new Map(rows.map(s => [s.id, `${s.role === 'PHYSICIAN' ? 'Dr. ' : ''}${s.firstName} ${s.lastName}`]));
  }
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
