import type { AuthUser } from '../auth/auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

type Row = Record<string, unknown>;
type Cond = { in?: unknown[]; notIn?: unknown[]; gte?: Date; lt?: Date };

function matches(row: Row, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key];
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      const c = cond as Cond;
      if (c.in && !c.in.includes(value)) return false;
      if (c.notIn && c.notIn.includes(value)) return false;
      if (c.gte && !((value as Date) >= c.gte)) return false;
      if (c.lt && !((value as Date) < c.lt)) return false;
      return true;
    }
    return value === cond;
  });
}

const EDT = 240; // UTC-4
const utc = (iso: string) => new Date(iso);

function fakePrisma() {
  const appointments: Row[] = [
    // Today (2026-10-27 local)
    { id: 'a1', patientId: 'ruth', providerId: 'doc-1', status: 'CHECKED_IN', slotStart: utc('2026-10-27T13:00:00Z'), slotEnd: utc('2026-10-27T13:45:00Z'), checkedInAt: utc('2026-10-27T12:55:00Z'), reasonForVisit: 'Dyspnea', appointmentType: { name: 'New Patient Visit', color: '#1976D2' } },
    { id: 'a2', patientId: 'liam', providerId: 'doc-1', status: 'CONFIRMED', slotStart: utc('2026-10-27T14:00:00Z'), slotEnd: utc('2026-10-27T14:15:00Z'), checkedInAt: null, reasonForVisit: null, appointmentType: { name: 'Follow-Up Visit', color: '#00897B' } },
    { id: 'a3', patientId: 'tom', providerId: 'doc-2', status: 'NO_SHOW', slotStart: utc('2026-10-27T12:00:00Z'), slotEnd: utc('2026-10-27T12:30:00Z'), checkedInAt: null, reasonForVisit: null, appointmentType: { name: 'Urgent Care', color: '#D32F2F' } },
    { id: 'a4', patientId: 'tom', providerId: 'doc-1', status: 'CANCELLED', slotStart: utc('2026-10-27T15:00:00Z'), slotEnd: utc('2026-10-27T15:30:00Z'), checkedInAt: null, reasonForVisit: null, appointmentType: null },
    // History
    { id: 'a5', patientId: 'liam', providerId: 'doc-1', status: 'COMPLETED', slotStart: utc('2026-10-20T13:00:00Z'), slotEnd: utc('2026-10-20T13:30:00Z') },
    { id: 'a6', patientId: 'ruth', providerId: 'doc-1', status: 'COMPLETED', slotStart: utc('2026-10-24T14:00:00Z'), slotEnd: utc('2026-10-24T14:30:00Z') },
    { id: 'a7', patientId: 'tom', providerId: 'doc-2', status: 'NO_SHOW', slotStart: utc('2026-10-22T14:00:00Z'), slotEnd: utc('2026-10-22T14:30:00Z') },
  ];
  const encounters: Row[] = [
    { id: 'e1', providerId: 'doc-1', status: 'IN_PROGRESS', createdAt: utc('2026-10-25T14:00:00Z') },
    { id: 'e2', providerId: 'doc-1', status: 'DRAFT', createdAt: utc('2026-10-27T13:30:00Z') },
    { id: 'e3', providerId: 'doc-2', status: 'SIGNED', createdAt: utc('2026-10-24T14:00:00Z') },
  ];
  const patients: Row[] = [
    { id: 'ruth', firstName: 'Ruth', lastName: 'Abernathy', mrn: 'CLV-4', alertsJson: JSON.stringify([
      { severity: 'CRITICAL', message: 'WARFARIN ALLERGY', isActive: true },
      { severity: 'HIGH', message: 'Falls risk', isActive: true },
    ]) },
    { id: 'liam', firstName: 'Liam', lastName: 'Okafor', mrn: 'CLV-5', alertsJson: JSON.stringify([
      { severity: 'CRITICAL', message: 'Resolved alert', isActive: false },
    ]) },
    { id: 'tom', firstName: 'Thomas', lastName: 'Reed', mrn: 'CLV-6', alertsJson: '[]' },
  ];
  const staff: Row[] = [
    { id: 'doc-1', firstName: 'Wei', lastName: 'Chen', role: 'PHYSICIAN' },
    { id: 'doc-2', firstName: 'Ananya', lastName: 'Patel', role: 'PHYSICIAN' },
  ];

  return {
    appointment: {
      findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        appointments.filter(a => matches(a, where)).sort((x, y) => (x['slotStart'] as Date).getTime() - (y['slotStart'] as Date).getTime())),
      count: jest.fn(async ({ where }: { where: Record<string, unknown> }) => appointments.filter(a => matches(a, where)).length),
      groupBy: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const counts = new Map<string, number>();
        appointments.filter(a => matches(a, where)).forEach(a => counts.set(a['status'] as string, (counts.get(a['status'] as string) ?? 0) + 1));
        return [...counts].map(([status, n]) => ({ status, _count: { _all: n } }));
      }),
    },
    encounter: { findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) => encounters.filter(e => matches(e, where))) },
    patient: { findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) => patients.filter(p => matches(p, where))) },
    staff: { findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) => staff.filter(s => matches(s, where))) },
  };
}

const user = (role: string): AuthUser => ({ id: 'u1', email: 'u@x', role, firstName: 'U', lastName: 'Ser' });
const NOW = utc('2026-10-27T14:00:00Z'); // 10:00 AM local

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(() => {
    service = new DashboardService(fakePrisma() as unknown as PrismaService);
  });

  it('computes practice-wide KPIs for the local day', async () => {
    const s = await service.getSummary({ date: '2026-10-27', tzOffset: EDT }, user('PHYSICIAN'), NOW);

    expect(s.scope).toBe('PRACTICE');
    expect(s.kpis).toEqual({
      appointmentsToday: 3,
      appointmentsLastWeek: 1,
      arrived: 1,
      waitingNow: 1,
      noShowsToday: 1,
      unsignedNotes: 2,
      unsignedOverdue: 1,
      noShowRate30d: 0.5,
    });
  });

  it('builds the roster in time order without cancelled visits', async () => {
    const s = await service.getSummary({ date: '2026-10-27', tzOffset: EDT }, user('PHYSICIAN'), NOW);

    expect(s.roster.map(r => r.appointmentId)).toEqual(['a3', 'a1', 'a2']);
    expect(s.roster.find(r => r.appointmentId === 'a1')).toEqual(expect.objectContaining({
      patientName: 'Ruth Abernathy',
      providerName: 'Dr. Wei Chen',
      typeName: 'New Patient Visit',
      hasCriticalAlert: true,
    }));
    expect(s.roster.find(r => r.appointmentId === 'a2')?.hasCriticalAlert).toBe(false);
  });

  it('derives alerts ordered by severity', async () => {
    const s = await service.getSummary({ date: '2026-10-27', tzOffset: EDT }, user('PHYSICIAN'), NOW);

    expect(s.alerts.map(a => [a.kind, a.severity])).toEqual([
      ['PATIENT_ALERT', 'CRITICAL'],
      ['LONG_WAIT', 'WARNING'],
      ['UNSIGNED_NOTES', 'WARNING'],
      ['NO_SHOW', 'INFO'],
    ]);
    const [critical, wait] = s.alerts;
    expect(critical.title).toBe('Ruth Abernathy · 9:00 AM');
    expect(critical.detail).toBe('WARFARIN ALLERGY');
    expect(wait.title).toBe('Waiting 1 h 5 min');
    expect(wait.detail).toContain('checked in at 8:55 AM');
    expect(wait.link).toEqual(['/encounters/new']);
    expect(wait.queryParams).toEqual({ appointmentId: 'a1', patientId: 'ruth' });
  });

  it('hides clinical data from non-clinical roles', async () => {
    const s = await service.getSummary({ date: '2026-10-27', tzOffset: EDT }, user('STAFF'), NOW);

    expect(s.kpis.unsignedNotes).toBeNull();
    expect(s.alerts.some(a => a.kind === 'UNSIGNED_NOTES')).toBe(false);
    expect(s.alerts.find(a => a.kind === 'LONG_WAIT')?.link).toEqual(['/calendar']);
  });

  it('scopes everything to one provider', async () => {
    const s = await service.getSummary({ date: '2026-10-27', tzOffset: EDT, providerId: 'doc-1' }, user('PHYSICIAN'), NOW);

    expect(s.scope).toBe('PROVIDER');
    expect(s.kpis.appointmentsToday).toBe(2);
    expect(s.kpis.noShowRate30d).toBe(0);
    expect(s.roster.every(r => r.providerId === 'doc-1')).toBe(true);
  });

  it('reports seven days of volume ending today and the peak window', async () => {
    const s = await service.getSummary({ date: '2026-10-27', tzOffset: EDT }, user('PHYSICIAN'), NOW);

    expect(s.weeklyVolume.map(v => v.date)).toEqual([
      '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27',
    ]);
    expect(s.weeklyVolume.map(v => v.count)).toEqual([0, 1, 0, 1, 0, 0, 3]);
    expect(s.peakHours).toEqual({ start: 9, end: 11 });
  });
});
