import {
  credentialExpiryStatus,
  daysUntil,
  defaultWeeklySchedule,
  displayName,
  isCredentialAlert,
  mostUrgentStatus,
  scheduleErrors,
} from './staff-domain';

const now = new Date('2026-10-28T15:00:00Z');
const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000);

describe('staff domain', () => {
  describe('credential expiry (90 / 30 / 7 day alerts)', () => {
    it.each([
      [-1, 'EXPIRED'], [0, 'DUE_7'], [7, 'DUE_7'], [8, 'DUE_30'], [30, 'DUE_30'], [31, 'DUE_90'], [90, 'DUE_90'], [91, 'VALID'],
    ] as const)('%i days out → %s', (days, status) => {
      expect(credentialExpiryStatus(inDays(days), now)).toBe(status);
    });

    it('treats credentials without an expiration as non-expiring', () => {
      expect(credentialExpiryStatus(null, now)).toBe('NO_EXPIRY');
      expect(daysUntil(null, now)).toBeNull();
    });

    it('picks the most urgent status and flags alerts', () => {
      expect(mostUrgentStatus(['VALID', 'DUE_30', 'NO_EXPIRY'])).toBe('DUE_30');
      expect(mostUrgentStatus([])).toBe('NO_EXPIRY');
      expect(isCredentialAlert('DUE_90')).toBe(true);
      expect(isCredentialAlert('VALID')).toBe(false);
    });
  });

  it('formats display names with title and suffix', () => {
    expect(displayName({ title: 'Dr.', firstName: 'Wei', lastName: 'Chen', suffix: 'MD' })).toBe('Dr. Wei Chen, MD');
    expect(displayName({ firstName: 'Ji-Yeon', lastName: 'Kim' })).toBe('Ji-Yeon Kim');
  });

  describe('weekly schedule', () => {
    it('defaults to weekdays 8–5 with lunch, which is valid', () => {
      const schedule = defaultWeeklySchedule();
      expect(schedule.filter(d => d.isWorking).map(d => d.dayOfWeek)).toEqual([1, 2, 3, 4, 5]);
      expect(scheduleErrors(schedule)).toEqual([]);
    });

    it('rejects inverted hours and lunch outside working hours', () => {
      const schedule = defaultWeeklySchedule().map(d =>
        d.dayOfWeek === 1 ? { ...d, hours: { start: '17:00', end: '08:00' } }
          : d.dayOfWeek === 2 ? { ...d, lunchBreak: { start: '07:00', end: '07:30' } }
          : d);
      expect(scheduleErrors(schedule)).toEqual([
        'Mon: working hours must start before they end.',
        'Tue: lunch break must fall within working hours.',
      ]);
    });

    it('requires all seven days', () => {
      expect(scheduleErrors(defaultWeeklySchedule().slice(0, 5))).toContain('Provide exactly one entry per day of the week.');
    });
  });
});
